/**
 * Loomy (讯飞 Loomy) quota data layer.
 * React-free / SCSS-free -- consumed directly by tests.
 *
 * Loomy reports two points pools and keeps them separate on purpose:
 *   - permanent points (`balance`), and
 *   - a daily allowance (`dailyBalance`) granted per business day that does not
 *     refill after consumption.
 *
 * The read endpoint reports neither the daily cap nor today's consumption, so
 * those stay optional here rather than defaulting to zero. This snapshot is
 * neither usage accounting nor scheduler cooldown: a points rejection cools the
 * credential, but a healthy balance does not prove the credential is routable.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, LoomyQuotaState } from '@/types';
import { loomyApi, type LoomyQuotaPayload } from '@/services/api/loomy';
import { isLoomyFile, isDisabledAuthFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

export type LoomyQuotaData = {
  permanent: number;
  daily: number;
  total: number;
  /** Absent when the read endpoint did not report the daily cap. */
  dailyQuota?: number;
  dailyConsumed?: number;
  dailyCycleDate?: string;
};

/**
 * Map the management payload to the view model.
 *
 * The daily-window fields are carried through only when present; substituting
 * zero would claim a measured cap and a measured consumption that were never
 * reported.
 */
export function buildLoomyQuotaData(payload: LoomyQuotaPayload): LoomyQuotaData {
  return {
    permanent: payload.permanent,
    daily: payload.daily,
    total: payload.total,
    ...(payload.daily_quota === undefined ? {} : { dailyQuota: payload.daily_quota }),
    ...(payload.daily_consumed === undefined ? {} : { dailyConsumed: payload.daily_consumed }),
    ...(payload.daily_cycle_date ? { dailyCycleDate: payload.daily_cycle_date } : {}),
  };
}

const statusOf = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status: unknown = error.status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const fetchLoomyQuota = async (file: AuthFileItem, t: TFunction): Promise<LoomyQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('loomy_quota.missing_auth_index'));
  }

  try {
    return buildLoomyQuotaData(await loomyApi.fetchQuota(authIndex));
  } catch (error: unknown) {
    const status = statusOf(error);
    if (status === 401 || status === 403) {
      const err = new Error(t('loomy_quota.invalid_credential')) as Error & { status?: number };
      err.status = status;
      throw err;
    }
    const message =
      error instanceof Error && error.message ? error.message : t('loomy_quota.quota_error');
    const err = new Error(message) as Error & { status?: number };
    err.status = status;
    throw err;
  }
};

export const LOOMY_CONFIG: QuotaProviderData<LoomyQuotaState, LoomyQuotaData> = {
  type: 'loomy',
  i18nPrefix: 'loomy_quota',
  filterFn: (file) => isLoomyFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchLoomyQuota,
  storeSelector: (state) => state.loomyQuota,
  storeSetter: 'setLoomyQuota',
  buildLoadingState: () => ({ status: 'loading' }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    error: message,
    errorStatus: status,
  }),
};
