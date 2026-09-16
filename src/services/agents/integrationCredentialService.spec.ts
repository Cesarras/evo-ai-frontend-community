import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/core/apiEvoAI', () => ({ default: {} }));

import {
  deleteConflictConsumers,
  deleteConflictHolders,
  parseHolders,
} from './integrationCredentialService';

const conflict = (details: unknown, status = 409) => ({
  response: {
    status,
    data: { success: false, error: { code: 'CONFLICT', message: 'still in use', details } },
  },
});

describe('parseHolders', () => {
  it('accepts every kind the core sends, with and without a key', () => {
    const holders = [
      { kind: 'integration', name: 'github' },
      { kind: 'tool', name: 'Busca', key: 'Authorization' },
      { kind: 'mcp', name: 'Zendesk', key: 'token' },
      { kind: 'agent', name: 'Cobrança', key: 'api_key' },
      { kind: 'channel_bot', name: 'whatsapp' },
    ];

    expect(parseHolders(holders)).toEqual(holders);
  });

  it('accepts an empty list: nobody holds the credential', () => {
    expect(parseHolders([])).toEqual([]);
  });

  it('keeps fields it does not read, so a core that adds one still parses', () => {
    const holders = [{ kind: 'tool', name: 'Busca', key: 'Authorization', id: 'x' }];

    expect(parseHolders(holders)).toEqual(holders);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an object', { kind: 'tool', name: 'Busca' }],
    ['a string', 'Ferramenta Busca [Authorization]'],
  ])('rejects %s instead of a list', (_label, value) => {
    expect(parseHolders(value)).toBeNull();
  });

  it.each([
    ['a null entry', null],
    ['a string entry', 'Ferramenta Busca [Authorization]'],
    ['a number entry', 42],
    ['a kind outside the vocabulary', { kind: 'webhook', name: 'Busca' }],
    ['a kind in another case', { kind: 'Tool', name: 'Busca' }],
    ['a missing kind', { name: 'Busca' }],
    ['a missing name', { kind: 'tool', key: 'Authorization' }],
    ['an empty name', { kind: 'tool', name: '' }],
    ['a blank name', { kind: 'tool', name: '   ' }],
    ['a numeric name', { kind: 'tool', name: 7 }],
    ['a null key', { kind: 'tool', name: 'Busca', key: null }],
    ['a numeric key', { kind: 'tool', name: 'Busca', key: 1 }],
  ])('discards the whole list for %s among valid holders', (_label, entry) => {
    const holders = [
      { kind: 'integration', name: 'github' },
      entry,
      { kind: 'channel_bot', name: 'whatsapp' },
    ];

    expect(parseHolders(holders)).toBeNull();
  });

  it('reads a large list and still rejects it for one bad entry at the end', () => {
    const holders = Array.from({ length: 500 }, (_, i) => ({
      kind: 'tool',
      name: `Busca ${i}`,
      key: 'Authorization',
    }));

    expect(parseHolders(holders)).toHaveLength(500);
    expect(parseHolders([...holders, { kind: 'tool', name: '' }])).toBeNull();
  });
});

describe('deleteConflictHolders', () => {
  const holders = [{ kind: 'tool', name: 'Busca', key: 'Authorization' }];

  it('reads the holders of a 409', () => {
    expect(deleteConflictHolders(conflict({ holders, consumers: ['x'] }))).toEqual(holders);
  });

  it.each([
    ['an empty list', conflict({ holders: [] })],
    ['a list with a bad entry', conflict({ holders: [...holders, { kind: 'x', name: 'y' }] })],
    ['details without holders', conflict({ consumers: ['Ferramenta Busca [Authorization]'] })],
    ['no details', conflict(undefined)],
    ['a status other than 409', conflict({ holders }, 400)],
    ['an error without a response', new Error('Network Error')],
    ['nothing', undefined],
  ])('answers null for %s', (_label, error) => {
    expect(deleteConflictHolders(error)).toBeNull();
  });

  it('leaves the strings readable when the holders are not', () => {
    const error = conflict({
      holders: [{ kind: 'webhook', name: 'Busca' }],
      consumers: ['Ferramenta Busca [Authorization]'],
    });

    expect(deleteConflictHolders(error)).toBeNull();
    expect(deleteConflictConsumers(error)).toEqual(['Ferramenta Busca [Authorization]']);
  });
});
