import { describe, it, expect } from 'vitest';
import {
  isBalancedExpression,
  detectTemplateFormVariables,
  extractTemplateFormVariables,
  extractTemplateVariables,
  buttonVariableName,
  templateVariableLabel,
} from './templateVariables';
import type { MessageTemplate, TemplateFormData } from '@/types/channels/inbox';

// EVO-1267 AC3: basic syntax gate for custom variable expressions.
describe('isBalancedExpression', () => {
  it('accepts plain text and balanced placeholders', () => {
    expect(isBalancedExpression('hello')).toBe(true);
    expect(isBalancedExpression('{{contact.name}}')).toBe(true);
    expect(isBalancedExpression('{{contact.name}} ({{pipeline.pipeline_stage.name}})')).toBe(true);
  });

  it('rejects unbalanced braces', () => {
    expect(isBalancedExpression('{{contact.name}')).toBe(false);
    expect(isBalancedExpression('{{contact.name')).toBe(false);
    expect(isBalancedExpression('contact.name}}')).toBe(false);
  });

  it('rejects unbalanced parentheses', () => {
    expect(isBalancedExpression('({{contact.name}}')).toBe(false);
    expect(isBalancedExpression('{{contact.name}})')).toBe(false);
  });

  it('rejects closers appearing before openers', () => {
    expect(isBalancedExpression(')(')).toBe(false);
    expect(isBalancedExpression('}{')).toBe(false);
  });
});

// EVO-1971: the two form-variable helpers diverge on purpose — `detect` is
// text-only (drives the live UI without accumulating stale rows) while `extract`
// re-attaches the declared metadata that the backend persists.
describe('template form variable helpers', () => {
  const form = (over: Partial<TemplateFormData>): TemplateFormData => ({
    name: 't',
    content: '',
    language: 'pt_BR',
    headerFormat: 'NONE',
    headerText: '',
    bodyText: '',
    footerText: '',
    buttons: [],
    ...over,
  });

  it('detectTemplateFormVariables is driven only by the current text', () => {
    const fd = form({
      bodyText: 'Oi {{nome}} de {{cidade}}',
      // A declared-but-no-longer-present variable must NOT resurface.
      variables: [{ name: 'antigo', example: 'x' }],
    });
    expect(detectTemplateFormVariables(fd).map(v => v.name)).toEqual(['nome', 'cidade']);
  });

  it('extractTemplateFormVariables preserves declared label/example/source for live tokens', () => {
    const fd = form({
      bodyText: 'Oi {{nome}}',
      variables: [{ name: 'nome', label: 'Nome', example: 'Maria', source: 'contact.name' }],
    });
    const nome = extractTemplateFormVariables(fd).find(v => v.name === 'nome');
    expect(nome).toMatchObject({ label: 'Nome', example: 'Maria', source: 'contact.name' });
  });
});

// A dynamic URL button carries its {{n}} in `url`, not in `text`, and Meta numbers it per
// button: the body's {{1}} and the button's {{1}} are two parameters, never one.
describe('extractTemplateVariables — dynamic URL button', () => {
  const metaTemplate = (components: MessageTemplate['components']): MessageTemplate => ({
    name: 'evo_lanc_reenvio_do_convite_de_grupo',
    language: 'pt_BR',
    content: '',
    components,
  });
  const body = { type: 'BODY' as const, text: 'Olá {{1}}, seu convite chegou.' };
  const urlButton = {
    type: 'URL' as const,
    text: 'Entrar no grupo agora',
    url: 'https://bms-link.evofoundation.ai/{{1}}',
  };
  const buttons = (...list: Array<typeof urlButton | { type: 'QUICK_REPLY' | 'PHONE_NUMBER'; text: string; phone_number?: string }>) => ({
    type: 'BUTTONS' as const,
    buttons: list,
  });

  it('body only: exactly the body variable, no button row (no regression)', () => {
    const vars = extractTemplateVariables(metaTemplate([body]));
    expect(vars.map(v => v.name)).toEqual(['1']);
    expect(vars[0].button).toBeUndefined();
  });

  it('button only: one variable named after the button, marked as a button parameter', () => {
    const vars = extractTemplateVariables(metaTemplate([buttons(urlButton)]));
    expect(vars).toHaveLength(1);
    expect(vars[0]).toMatchObject({
      name: 'button_0_1',
      component: 'BUTTONS',
      type: 'url',
      required: true,
      button: { index: 0, parameter: 1 },
    });
  });

  it('body and button: two rows, the button after the body, never collapsed into one {{1}}', () => {
    const vars = extractTemplateVariables(metaTemplate([body, buttons(urlButton)]));
    expect(vars.map(v => v.name)).toEqual(['1', 'button_0_1']);
  });

  it('indexes the button among ALL buttons, the way Meta counts them', () => {
    const vars = extractTemplateVariables(
      metaTemplate([body, buttons({ type: 'QUICK_REPLY', text: 'Sim' }, urlButton)]),
    );
    expect(vars.map(v => v.name)).toEqual(['1', buttonVariableName(1, 1)]);
  });

  it('ignores quick-reply, phone and static URL buttons', () => {
    const vars = extractTemplateVariables(
      metaTemplate([
        body,
        buttons(
          { type: 'QUICK_REPLY', text: 'Sim' },
          { type: 'PHONE_NUMBER', text: 'Ligar', phone_number: '+5511999999999' },
          { ...urlButton, url: 'https://evofoundation.ai/planos' },
        ),
      ]),
    );
    expect(vars.map(v => v.name)).toEqual(['1']);
  });

  it('reads the object form of components the API also returns', () => {
    const vars = extractTemplateVariables(metaTemplate({ body, buttons: buttons(urlButton) }));
    expect(vars.map(v => v.name)).toEqual(['1', 'button_0_1']);
  });

  it('labels a backend-declared button variable from its name alone (journey/automation pickers)', () => {
    const t = (key: string, options?: Record<string, unknown>) =>
      `${key}:${options?.button}:${options?.n}`;
    expect(templateVariableLabel({ name: 'button_1_1' }, t)).toBe('templateButtonUrlParam:2:1');
    expect(templateVariableLabel({ name: 'button_x' }, t)).toBe('button_x');
  });

  it('labels the button parameter through i18n, and the body one as before', () => {
    const t = (key: string, options?: Record<string, unknown>) =>
      `${key}:${options?.button}:${options?.n}`;
    const vars = extractTemplateVariables(metaTemplate([body, buttons(urlButton)]));
    expect(templateVariableLabel(vars[0], t)).toBe('1');
    expect(templateVariableLabel(vars[1], t)).toBe('templateButtonUrlParam:1:1');
  });
});

describe('template form variable helpers — buttons', () => {
  it('detectTemplateFormVariables sees the URL button of the local editor', () => {
    const fd: TemplateFormData = {
      name: 't',
      content: '',
      language: 'pt_BR',
      headerFormat: 'NONE',
      bodyText: 'Oi {{1}}',
      buttons: [{ type: 'URL', text: 'Abrir', url: 'https://x.test/{{1}}' }],
    };
    expect(detectTemplateFormVariables(fd).map(v => v.name)).toEqual(['1', 'button_0_1']);
  });
});
