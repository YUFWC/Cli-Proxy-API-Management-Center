/**
 * LobsterAI (NetEase/Youdao) quota data layer.
 * React-free / SCSS-free -- consumed directly by tests.
 *
 * The backend reports a credit balance and the read-only state of its daily
 * check-in activity through the proxy's dedicated /lobsterai-server-quota
 * endpoint. Three quantities are deliberately kept apart and must not be
 * conflated:
 *   1. this credit/plan snapshot (the backend's own read),
 *   2. usage accounting (tokens for a single request), and
 *   3. scheduler cooldown, which is local routing state and not a balance.
 *
 * A balance the backend did not report stays unknown: `creditsKnown` is false
 * and the card renders "--" rather than zero or "unlimited". The activity field
 * is observation only -- the proxy never claims the check-in reward.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, LobsteraiServerQuotaState, LobsteraiServerQuotaActivity } from '@/types';
import {
  lobsteraiServerQuotaApi,
  type LobsteraiServerQuotaPayload,
} from '@/services/api/lobsteraiServerQuota';
import { isLobsteraiServerFile, isDisabledAuthFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

export type LobsteraiServerQuotaData = {
  subscriptionStatus: string;
  credits: number;
  creditsKnown: boolean;
  purchasedCredits: number;
  activity: LobsteraiServerQuotaActivity;
};

/**
 * Map the management payload to the view model.
 *
 * `credits_known` is honoured rather than inferred from the amount: the backend
 * omits it when the account has no measured balance, and fabrication here would
 * show a healthy balance for an account that was never measured.
 */
export function buildLobsteraiServerQuotaData(
  payload: LobsteraiServerQuotaPayload
): LobsteraiServerQuotaData {
  return {
    subscriptionStatus: (payload.subscription_status ?? '').trim(),
    credits: payload.credits ?? 0,
    creditsKnown: payload.credits_known === true,
    purchasedCredits: payload.purchased_credits ?? 0,
    activity: {
      available: payload.activity_available === true,
      code: payload.activity_code,
      template: payload.activity_template,
      placement: payload.activity_placement,
      context: payload.activity_context,
    },
  };
}

const statusOf = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status: unknown = error.status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const fetchLobsteraiServerQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<LobsteraiServerQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('lobsterai_server_quota.missing_auth_index'));
  }

  try {
    return buildLobsteraiServerQuotaData(await lobsteraiServerQuotaApi.fetchQuota(authIndex));
  } catch (error: unknown) {
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      const err = new Error(t('lobsterai_server_quota.invalid_credential')) as Error & {
        status?: number;
      };
      err.status = status;
      throw err;
    }
    const message =
      error instanceof Error && error.message
        ? error.message
        : t('lobsterai_server_quota.quota_error');
    const err = new Error(message) as Error & { status?: number };
    err.status = status;
    throw err;
  }
};

export const LOBSTERAI_SERVER_CONFIG: QuotaProviderData<
  LobsteraiServerQuotaState,
  LobsteraiServerQuotaData
> = {
  type: 'lobsterai-server',
  i18nPrefix: 'lobsterai_server_quota',
  filterFn: (file) => isLobsteraiServerFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchLobsteraiServerQuota,
  storeSelector: (state) => state.lobsteraiServerQuota,
  storeSetter: 'setLobsteraiServerQuota',
  buildLoadingState: () => ({ status: 'loading', creditsKnown: false }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    creditsKnown: false,
    error: message,
    errorStatus: status,
  }),
};
