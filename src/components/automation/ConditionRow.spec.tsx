import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  automationRuleSchema,
  type AutomationRuleFormData,
} from '@/pages/Customer/Automation/registries';
import type { AutomationEventType } from '@/types/automation';
import ConditionRow from './ConditionRow';
import type { AutomationFormData } from '@/hooks/automation/useAutomationFormData';

class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverPolyfill as never);

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const emptyFormData: AutomationFormData = {
  inboxes: [],
  agents: [],
  teams: [],
  labels: [],
  companies: [],
  pipelines: [],
  pipelineStages: [],
  priorities: [],
  statuses: [],
  messageTypes: [],
  cannedResponses: [],
  messageTemplates: [],
};

let lastMethods: ReturnType<typeof useForm<AutomationRuleFormData>> | null = null;
function FormWithData({ defaultValues, formData }: { defaultValues: AutomationRuleFormData; formData: AutomationFormData }) {
  const methods = useForm<AutomationRuleFormData>({
    resolver: zodResolver(automationRuleSchema),
    defaultValues,
  });
  lastMethods = methods;
  return (
    <FormProvider {...methods}>
      <ConditionRow control={methods.control} index={0} formData={formData} onRemove={() => {}} />
    </FormProvider>
  );
}
function renderWithForm(defaultValues: AutomationRuleFormData, formData: AutomationFormData) {
  render(<FormWithData defaultValues={defaultValues} formData={formData} />);
  return lastMethods!;
}

function Wrapper({ defaultValues }: { defaultValues: AutomationRuleFormData }) {
  const methods = useForm<AutomationRuleFormData>({
    resolver: zodResolver(automationRuleSchema),
    defaultValues,
  });
  return (
    <FormProvider {...methods}>
      <ConditionRow control={methods.control} index={0} formData={emptyFormData} onRemove={() => {}} />
    </FormProvider>
  );
}

function EventSwitchHarness({
  defaultValues,
  nextEvent,
  onOperatorChange,
}: {
  defaultValues: AutomationRuleFormData;
  nextEvent: AutomationEventType;
  onOperatorChange: (op: string) => void;
}) {
  const methods = useForm<AutomationRuleFormData>({
    resolver: zodResolver(automationRuleSchema),
    defaultValues,
  });

  useEffect(() => {
    const id = setTimeout(() => {
      methods.setValue('event_name', nextEvent, { shouldDirty: true });
    }, 50);
    return () => clearTimeout(id);
  }, [methods, nextEvent]);

  useEffect(() => {
    const subscription = methods.watch((value) => {
      onOperatorChange(value.conditions?.[0]?.filter_operator ?? '');
    });
    return () => subscription.unsubscribe();
  }, [methods, onOperatorChange]);

  return (
    <FormProvider {...methods}>
      <ConditionRow control={methods.control} index={0} formData={emptyFormData} onRemove={() => {}} />
    </FormProvider>
  );
}

describe('ConditionRow', () => {
  it('renders without crashing for an empty condition', () => {
    const defaults: AutomationRuleFormData = {
      name: 'Test',
      description: '',
      event_name: 'conversation_created',
      active: true,
      mode: 'simple',
      conditions: [
        {
          attribute_key: '',
          filter_operator: 'equal_to',
          query_operator: 'AND',
          values: [],
        },
      ],
      actions: [
        {
          action_name: 'send_message',
          action_params: ['hello'],
        },
      ],
    };
    render(<Wrapper defaultValues={defaults} />);
    expect(screen.getByText(/form\.fields\.conditionRow\.attribute/)).toBeTruthy();
  });

  it('omits attribute_changed from the operator dropdown on conversation_created (no previous value)', async () => {
    const user = userEvent.setup();
    const defaults: AutomationRuleFormData = {
      name: 'Test',
      description: '',
      event_name: 'conversation_created',
      active: true,
      mode: 'simple',
      conditions: [
        {
          attribute_key: 'status',
          filter_operator: 'equal_to',
          query_operator: 'AND',
          values: [],
        },
      ],
      actions: [{ action_name: 'send_message', action_params: ['hello'] }],
    };
    render(<Wrapper defaultValues={defaults} />);

    const triggers = screen.getAllByRole('combobox');
    expect(triggers.length).toBeGreaterThanOrEqual(2);
    await user.click(triggers[1]);

    const options = screen.getAllByRole('option').map((el) => el.textContent ?? '');
    expect(options.some((label) => /equal_to/.test(label))).toBe(true);
    expect(options.some((label) => /attribute_changed/.test(label))).toBe(false);
  });

  it('exposes attribute_changed in the operator dropdown on conversation_updated', async () => {
    const user = userEvent.setup();
    const defaults: AutomationRuleFormData = {
      name: 'Test',
      description: '',
      event_name: 'conversation_updated',
      active: true,
      mode: 'simple',
      conditions: [
        {
          attribute_key: 'status',
          filter_operator: 'equal_to',
          query_operator: 'AND',
          values: [],
        },
      ],
      actions: [{ action_name: 'send_message', action_params: ['hello'] }],
    };
    render(<Wrapper defaultValues={defaults} />);

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[1]);

    const options = screen.getAllByRole('option').map((el) => el.textContent ?? '');
    expect(options.some((label) => /attribute_changed/.test(label))).toBe(true);
  });

  it('clears the operator when switching to an event where it is no longer available', async () => {
    const observed: string[] = [];
    const defaults: AutomationRuleFormData = {
      name: 'Test',
      description: '',
      event_name: 'conversation_updated',
      active: true,
      mode: 'simple',
      conditions: [
        {
          attribute_key: 'status',
          filter_operator: 'attribute_changed',
          query_operator: 'AND',
          values: { from: ['open'], to: ['resolved'] },
        },
      ],
      actions: [{ action_name: 'send_message', action_params: ['hi'] }],
    };

    render(
      <EventSwitchHarness
        defaultValues={defaults}
        nextEvent="conversation_created"
        onOperatorChange={(op) => observed.push(op)}
      />,
    );

    await waitFor(() => {
      expect(observed[observed.length - 1]).toBe('');
    });
  });

  // CRM-509: the company value is a pick from the account's companies (id), and the
  // presence operators need no value at all.
  it('offers the companies as the value of a company condition', async () => {
    const withCompanies: AutomationFormData = {
      ...emptyFormData,
      companies: [
        { id: 'c-acme', name: 'Acme' },
        { id: 'c-globex', name: 'Globex' },
      ],
    };
    const defaults: AutomationRuleFormData = {
      name: 'Test',
      description: '',
      event_name: 'contact_updated',
      active: true,
      mode: 'simple',
      conditions: [
        {
          attribute_key: 'company',
          filter_operator: 'equal_to',
          query_operator: 'AND',
          values: ['c-globex'],
        },
      ],
      actions: [{ action_name: 'add_label', action_params: [] }],
    };
    const methods = renderWithForm(defaults, withCompanies);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Globex')).toBeTruthy();

    await userEvent.click(screen.getAllByRole('combobox')[1]);
    const opNames = (await screen.findAllByRole('option')).map((o) => o.textContent);
    // t() is the identity here, so the per-attribute override falls back to the generic key.
    expect(opNames.sort()).toEqual([
      'form.fields.operators.equal_to',
      'form.fields.operators.is_not_present',
      'form.fields.operators.is_present',
      'form.fields.operators.not_equal_to',
    ]);

    await userEvent.click(screen.getByRole('option', { name: 'form.fields.operators.is_present' }));
    await waitFor(() => expect(methods.getValues('conditions.0.filter_operator')).toBe('is_present'));
    expect(screen.queryByText('Globex')).toBeNull();
  });

  it('renders From and To labels when filter_operator is attribute_changed', () => {
    const defaults: AutomationRuleFormData = {
      name: 'Test',
      description: '',
      event_name: 'conversation_updated',
      active: true,
      mode: 'simple',
      conditions: [
        {
          attribute_key: 'status',
          filter_operator: 'attribute_changed',
          query_operator: 'AND',
          values: { from: [], to: [] },
        },
      ],
      actions: [
        {
          action_name: 'send_message',
          action_params: ['hello'],
        },
      ],
    };
    render(<Wrapper defaultValues={defaults} />);
    expect(screen.getAllByText(/form\.fields\.conditionRow\.from/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/form\.fields\.conditionRow\.to/).length).toBeGreaterThan(0);
  });
});
