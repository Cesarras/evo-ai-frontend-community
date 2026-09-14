import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A plain function, not a spy: the spy's own result tracking turns the rejected
// promise into an unhandled rejection in vitest 2.
const companies = vi.hoisted(() => ({ calls: 0, impl: async (): Promise<unknown> => [] }));

vi.mock('@/services/automation/automationService', () => ({
  automationService: { getFormData: vi.fn().mockResolvedValue({ inboxes: [], agents: [], teams: [], labels: [{ id: 'l1', title: 'vip' }] }) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn() },
}));
vi.mock('@/services/cannedResponses/cannedResponsesService', () => ({
  cannedResponsesService: { getCannedResponses: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/services/channels/messageTemplatesService', () => ({ default: { getTemplates: vi.fn() } }));
vi.mock('@/services/customAttributes/customAttributesService', () => ({
  customAttributesService: { getCustomAttributes: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: { getCompaniesList: () => { companies.calls += 1; return companies.impl(); } },
}));

import { useAutomationFormData } from './useAutomationFormData';

describe('useAutomationFormData — companies', () => {
  beforeEach(() => { companies.calls = 0; companies.impl = async () => []; });

  it('loads the companies as id/name options next to the other form data', async () => {
    companies.impl = async () => [
      { id: 'c-acme', name: 'Acme' },
      { id: 'c-globex', name: 'Globex' },
    ];
    const { result } = renderHook(() => useAutomationFormData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(companies.calls).toBe(1);
    expect(result.current.data.companies).toEqual([
      { id: 'c-acme', name: 'Acme' },
      { id: 'c-globex', name: 'Globex' },
    ]);
    expect(result.current.data.labels).toEqual([{ id: 'l1', name: 'vip' }]);
  });

  it('falls back to no companies when the list fails, keeping the rest', async () => {
    companies.impl = () => Promise.reject(new Error('boom'));
    const { result } = renderHook(() => useAutomationFormData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.companies).toEqual([]);
    expect(result.current.data.labels).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });
});
