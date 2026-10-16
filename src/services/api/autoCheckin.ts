import { apiClient } from './client';

export interface CheckinProviderConfig {
  enabled: boolean;
  timezone: string;
  window: { start: string; end: string };
  headers: Record<string, string>;
}

export interface CheckinCapability {
  id: string;
  name: string;
  defaults: CheckinProviderConfig;
  protectedHeaders: string[];
}

export interface CheckinProviderStatus {
  id: string;
  enabled: boolean;
  timezone: string;
  date: string;
  configFingerprint: string;
}

export interface CheckinAccountStatus {
  authId: string;
  account: string;
  provider: string;
  date: string;
  phase: string;
  trigger: string;
  outcome: string;
  completed: boolean;
  scheduledAt: string;
  startedAt: string;
  finishedAt: string;
  error: string;
  warning: string;
}

export interface CheckinSnapshot {
  configFingerprint: string;
  disabledReason: string;
  providers: CheckinProviderStatus[];
  accounts: CheckinAccountStatus[];
}

export type CheckinConfigMap = Record<string, Partial<CheckinProviderConfig>>;

type RawCapability = Omit<CheckinCapability, 'protectedHeaders'> & { protected_headers?: string[] };
type RawProvider = Omit<CheckinProviderStatus, 'configFingerprint'> & {
  config_fingerprint: string;
};
type RawAccount = Omit<
  CheckinAccountStatus,
  'authId' | 'scheduledAt' | 'startedAt' | 'finishedAt'
> & {
  auth_id: string;
  scheduled_at?: string;
  started_at?: string;
  finished_at?: string;
};

export const autoCheckinApi = {
  async capabilities(signal?: AbortSignal): Promise<CheckinCapability[]> {
    const data = await apiClient.get<{ providers: RawCapability[] }>(
      '/automation/checkin/providers',
      { signal }
    );
    return (data.providers ?? []).map(({ protected_headers, ...provider }) => ({
      ...provider,
      protectedHeaders: protected_headers ?? [],
    }));
  },

  async config(signal?: AbortSignal): Promise<CheckinConfigMap> {
    const data = await apiClient.get<{ providers?: CheckinConfigMap } | null>(
      '/config/automation/checkin',
      { signal }
    );
    return data?.providers ?? {};
  },

  async status(signal?: AbortSignal): Promise<CheckinSnapshot> {
    const data = await apiClient.get<{
      config_fingerprint: string;
      disabled_reason?: string;
      providers?: RawProvider[];
      accounts?: RawAccount[];
    }>('/automation/checkin/status', { signal });
    return {
      configFingerprint: data.config_fingerprint,
      disabledReason: data.disabled_reason ?? '',
      providers: (data.providers ?? []).map(({ config_fingerprint, ...provider }) => ({
        ...provider,
        configFingerprint: config_fingerprint,
      })),
      accounts: (data.accounts ?? []).map((account) => ({
        authId: account.auth_id,
        account: account.account,
        provider: account.provider,
        date: account.date,
        phase: account.phase,
        trigger: account.trigger,
        outcome: account.outcome ?? '',
        completed: account.completed,
        scheduledAt: account.scheduled_at ?? '',
        startedAt: account.started_at ?? '',
        finishedAt: account.finished_at ?? '',
        error: account.error ?? '',
        warning: account.warning ?? '',
      })),
    };
  },

  async saveProvider(id: string, value: CheckinProviderConfig, signal?: AbortSignal) {
    const data = await apiClient.put<{ config_fingerprint: string }>(
      `/config/automation/checkin/providers/${encodeURIComponent(id)}`,
      value,
      { signal }
    );
    return data.config_fingerprint;
  },
};
