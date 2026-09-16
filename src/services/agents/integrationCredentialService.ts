import evoaiApi from '@/services/core/apiEvoAI';
import { apiErrorCode, extractData, buildPaginationParams } from '@/utils/apiHelpers';
import type {
  IntegrationCredential,
  IntegrationCredentialCreate,
  IntegrationCredentialDeleteResponse,
  IntegrationCredentialHolder,
  IntegrationCredentialUpdate,
} from '@/types/agents';

// EVO-2250 story 2.1: the integration-credential vault. The registry lives in
// evo-ai-core-service (`evo_core_integration_credentials`); routes mirror the
// sibling top-level resources (`/custom-tools`, `/custom-mcp-servers`).
// The API returns `value_hint` only — the value itself never leaves the server.

export const listIntegrationCredentials = async (
  page = 1,
  pageSize = 100,
): Promise<IntegrationCredential[]> => {
  const response = await evoaiApi.get('/integration-credentials', {
    params: buildPaginationParams(page, pageSize),
  });
  return extractData<IntegrationCredential[]>(response);
};

export const createIntegrationCredential = async (
  data: IntegrationCredentialCreate,
): Promise<IntegrationCredential> => {
  const response = await evoaiApi.post('/integration-credentials', data);
  return extractData<IntegrationCredential>(response);
};

export const updateIntegrationCredential = async (
  credentialId: string,
  data: IntegrationCredentialUpdate,
): Promise<IntegrationCredential> => {
  const response = await evoaiApi.put(`/integration-credentials/${credentialId}`, data);
  return extractData<IntegrationCredential>(response);
};

export const deleteIntegrationCredential = async (
  credentialId: string,
): Promise<IntegrationCredentialDeleteResponse> => {
  const response = await evoaiApi.delete(`/integration-credentials/${credentialId}`);
  return extractData<IntegrationCredentialDeleteResponse>(response);
};

const HOLDER_KINDS = new Set(['integration', 'tool', 'mcp', 'agent', 'channel_bot']);

// One entry the screen cannot label discards the whole list, so the caller
// falls back to the display strings instead of showing part of the holders.
export const parseHolders = (value: unknown): IntegrationCredentialHolder[] | null => {
  if (!Array.isArray(value)) return null;

  const valid = value.every(entry => {
    if (!entry || typeof entry !== 'object') return false;
    const { kind, name, key } = entry as Record<string, unknown>;
    return (
      typeof kind === 'string' &&
      HOLDER_KINDS.has(kind) &&
      typeof name === 'string' &&
      name.trim() !== '' &&
      (key === undefined || typeof key === 'string')
    );
  });

  return valid ? (value as IntegrationCredentialHolder[]) : null;
};

// The delete refuses with 409 while a consumer still points at the credential,
// naming each holder in `details`. The whole shape is required, not just the
// status: a conflict without holders would render a list asserting that
// somebody holds it and showing nobody.
const deleteConflictDetails = (error: unknown): Record<string, unknown> | null => {
  if (!error || typeof error !== 'object') return null;

  const response = (error as { response?: { status?: number; data?: unknown } }).response;
  if (response?.status !== 409 || apiErrorCode(error) !== 'CONFLICT') return null;

  const data = response.data;
  if (!data || typeof data !== 'object') return null;

  const details = (data as { error?: { details?: unknown } }).error?.details;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : null;
};

export const deleteConflictHolders = (error: unknown): IntegrationCredentialHolder[] | null => {
  const holders = parseHolders(deleteConflictDetails(error)?.holders);
  return holders && holders.length > 0 ? holders : null;
};

// `details.consumers` carries the same holders as pt-BR display strings.
export const deleteConflictConsumers = (error: unknown): string[] | null => {
  const consumers = deleteConflictDetails(error)?.consumers;
  if (!Array.isArray(consumers) || consumers.length === 0) return null;
  if (!consumers.every(entry => typeof entry === 'string' && entry.trim() !== '')) return null;

  return consumers as string[];
};

// EVO-2250 story 2.7: the retirement guard, per consumer. A consumer only
// retires its inline secret entry after the 2.6 migration ran on this
// installation (or there was never anything to migrate). While the guard says
// no, every inline field stays exactly as it is.
export interface IntegrationVaultMigrationState {
  retired: {
    custom_tools?: boolean;
    custom_mcp_servers?: boolean;
    knowledge_nexus?: boolean;
    agent_bots?: boolean;
    external_agents?: boolean;
  };
}

export const getIntegrationVaultMigrationState =
  async (): Promise<IntegrationVaultMigrationState> => {
    const response = await evoaiApi.get('/integration-credentials/migration-state');
    return extractData<IntegrationVaultMigrationState>(response);
  };
