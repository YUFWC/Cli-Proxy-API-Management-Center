/**
 * Loomy (讯飞 Loomy) phone SMS login and quota APIs.
 *
 * Loomy has no browser authorization page, so it does not use the shared
 * `oauth/auth-url` contract. Signing in is two explicit steps against the
 * backend's dedicated endpoints:
 *
 *   POST /loomy-sms-code  { phone }                    -> { msg_id }
 *   POST /loomy-login     { phone, code, msg_id }      -> saves the auth file
 *
 * The verification code and the returned session never leave the backend: the
 * login response carries only the credential id, so no credential is rendered
 * by the panel.
 *
 * The quota read returns the two points pools separately. Loomy's daily
 * allowance does not refill after consumption, and the read endpoint does not
 * report the daily cap at all — an absent field means unknown, never zero.
 */

import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export interface LoomySMSCodeResponse {
  status: 'ok';
  flow: 'sms';
  msg_id: string;
}

export interface LoomyLoginResponse {
  status: 'ok';
  provider: string;
  /** Auth file name the backend persisted. */
  id: string;
  /** Display label (phone number or account id). */
  label?: string;
}

export interface LoomyQuotaPayload {
  /** Permanent points balance. */
  permanent: number;
  /** Daily allowance balance remaining today. */
  daily: number;
  /** Permanent + daily. */
  total: number;
  /**
   * Daily allowance cap. Omitted when the read endpoint did not report one;
   * absence means unknown, not zero.
   */
  daily_quota?: number;
  /** Points consumed from the daily pool today. Omitted when not reported. */
  daily_consumed?: number;
  /** Business day the daily pool belongs to (`YYYY-MM-DD`). */
  daily_cycle_date?: string;
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
 * Normalize the management quota response.
 *
 * `permanent` and `total` are the anchors: a payload without them carries no
 * usable balance and is rejected, so the card reports a read failure instead of
 * rendering a fabricated zero. The daily-window fields stay optional.
 */
export function parseLoomyQuotaPayload(input: unknown): LoomyQuotaPayload | null {
  if (!isRecord(input)) return null;
  const permanent = readNumber(input.permanent);
  const total = readNumber(input.total);
  if (permanent === null || total === null) return null;
  return {
    permanent,
    daily: readNumber(input.daily) ?? 0,
    total,
    daily_quota: readNumber(input.daily_quota) ?? undefined,
    daily_consumed: readNumber(input.daily_consumed) ?? undefined,
    daily_cycle_date: readString(input.daily_cycle_date),
  };
}

export const loomyApi = {
  /**
   * Ask the account service to deliver an SMS code. The returned msg_id must be
   * submitted with the code; it is not a credential.
   */
  requestSMSCode: (phone: string, signal?: AbortSignal) =>
    apiClient.post<LoomySMSCodeResponse>(
      '/loomy-sms-code',
      { phone: phone.trim() },
      { signal, timeout: 35_000 }
    ),

  /** Complete the SMS login; the backend persists the session. */
  login: (phone: string, code: string, msgId: string, signal?: AbortSignal) =>
    apiClient.post<LoomyLoginResponse>(
      '/loomy-login',
      { phone: phone.trim(), code: code.trim(), msg_id: msgId },
      { signal, timeout: 65_000 }
    ),

  fetchQuota: async (authIndex: string): Promise<LoomyQuotaPayload> => {
    const response = await apiClient.get<unknown>('/loomy-quota', {
      params: { auth_index: authIndex },
    });
    const payload = parseLoomyQuotaPayload(response);
    if (!payload) {
      throw new Error('empty_data');
    }
    return payload;
  },
};
