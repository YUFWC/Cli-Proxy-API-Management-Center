/**
 * Loomy (讯飞 Loomy) quota render body: the two points pools side by side.
 *
 * Loomy's permanent pool and daily allowance are independent: the daily pool is
 * granted per business day and does not refill after consumption, so a single
 * "remaining" figure would hide which pool the next request draws from. No reset
 * countdown is rendered: the read endpoint does not report a reset time, and the
 * card must not invent one.
 *
 * When the read endpoint did not report the daily cap or today's consumption,
 * those rows are omitted rather than shown as zero.
 */

import { useTranslation } from 'react-i18next';
import type { LoomyQuotaState } from '@/types';
import type { QuotaBodyProps } from '../../types';

export function LoomyQuotaBody({ quota, classes }: QuotaBodyProps<LoomyQuotaState>) {
  const { t } = useTranslation();
  if (quota.status !== 'success') {
    return <div className={classes.quotaMessage}>{t('loomy_quota.empty_data')}</div>;
  }

  const permanent = quota.permanent ?? 0;
  const daily = quota.daily ?? 0;
  const total = quota.total ?? permanent + daily;
  const points = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <>
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t('loomy_quota.total_row')}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaAmount}>{points(total)}</span>
          </div>
        </div>
      </div>
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t('loomy_quota.permanent_row')}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaAmount}>{points(permanent)}</span>
          </div>
        </div>
      </div>
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t('loomy_quota.daily_row')}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaAmount}>
              {quota.dailyQuota !== undefined
                ? `${points(daily)} / ${points(quota.dailyQuota)}`
                : points(daily)}
            </span>
          </div>
        </div>
      </div>
      {quota.dailyConsumed !== undefined && (
        <div className={classes.quotaRow}>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>{t('loomy_quota.daily_consumed_row')}</span>
            <div className={classes.quotaMeta}>
              <span className={classes.quotaAmount}>{points(quota.dailyConsumed)}</span>
            </div>
          </div>
        </div>
      )}
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaMessage}>{t('loomy_quota.daily_hint')}</span>
        </div>
      </div>
    </>
  );
}
