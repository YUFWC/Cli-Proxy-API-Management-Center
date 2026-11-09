import { apiClient } from '../../src/services/api/client';
import type { ProviderFamily } from '../../src/services/api/providers';

export type BackendCall = { method: string; url: string; body?: unknown };

/** Serve one provider family as the backend's v8 `api-keys` groups: GET /config returns the stored groups, PUT /config/api-keys/<family> replaces them, and every call is recorded. */
export function mockProviderGroupsBackend(
  family: ProviderFamily,
  groups: Record<string, unknown>[]
) {
  let stored = structuredClone(groups);
  const calls: BackendCall[] = [];
  apiClient.get = (async (url: string) => {
    calls.push({ method: 'GET', url });
    return { 'api-keys': { [family]: structuredClone(stored) } };
  }) as typeof apiClient.get;
  apiClient.put = (async (url: string, data?: unknown) => {
    calls.push({ method: 'PUT', url, body: data });
    stored = structuredClone(data as Record<string, unknown>[]);
    return undefined;
  }) as typeof apiClient.put;
  return { calls, groups: () => stored };
}

/** Normalized rows carry a `source` back-reference to the raw groups for writes; contract assertions compare the row without it. */
export function withoutSource<T extends { source?: unknown }>(rows: T[] | undefined) {
  return (rows ?? []).map(({ source, ...row }) => {
    void source;
    return row;
  });
}
