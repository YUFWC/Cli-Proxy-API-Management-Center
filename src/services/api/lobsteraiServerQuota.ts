/**
 * LobsterAI (NetEase/Youdao) quota service.
 *
 * LobsterAI reports credits and plan status through its own account backend
 * rather than an OpenAI-compatible billing surface, so the balance cannot be
 * read through the generic /api-call forwarder. The proxy exposes a dedicated
 * management endpoint that resolves the credential's access token and returns
 * the backend's read-only credit/plan view.
 *
 * The endpoint also reports the read-only state of the daily check-in activity.
 * The proxy never performs the check-in on the account's behalf.
 */

import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

/** Shape returned by GET /v0/management/lobsterai-server-quota. */
export interface LobsteraiServerQuotaPayload {
  subscription_status?: string;
  credits?: number;
  /** False when the backend omitted the balance; absent is not zero. */
  credits_known?: boolean;
  purchased_credits?: number;
  activity_available?: boolean;
  activity_code?: string;
  activity_template?: string;
  activity_placement?: string;
  activity_context?: Record<string, unknown>;
}

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/**
 * Normalize the management response.
 *
 * A payload with neither a plan nor a balance carries no usable information and
 * is rejected; a payload whose `credits_known` is false is kept, because the
 * plan and the activity state are still worth showing even when the balance
 * cannot be derived.
 */
export function parseLobsteraiServerQuotaPayload(
  input: unknown
): LobsteraiServerQuotaPayload | null {
  if (!isRecord(input)) return null;
  const credits = readNumber(input.credits);
  const subscriptionStatus = readString(input.subscription_status);
  const activityCode = readString(input.activity_code);
  if (credits === null && subscriptionStatus === undefined && activityCode === undefined) {
    return null;
  }
  return {
    subscription_status: subscriptionStatus,
    credits: credits ?? undefined,
    // Default to unknown unless the backend explicitly reports otherwise.
    credits_known: input.credits_known === true,
    purchased_credits: readNumber(input.purchased_credits) ?? undefined,
    activity_available: input.activity_available === true,
    activity_code: activityCode,
    activity_template: readString(input.activity_template),
    activity_placement: readString(input.activity_placement),
    activity_context: isRecord(input.activity_context) ? input.activity_context : undefined,
  };
}

export const lobsteraiServerQuotaApi = {
  fetchQuota: async (authIndex: string): Promise<LobsteraiServerQuotaPayload> => {
    const response = await apiClient.get<unknown>('/lobsterai-server-quota', {
      params: { auth_index: authIndex },
    });
    const payload = parseLobsteraiServerQuotaPayload(response);
    if (!payload) {
      throw new Error('empty_data');
    }
    return payload;
  },
};
