/**
 * LobsterAI (NetEase/Youdao) quota render body: the account's credit balance and
 * plan status, plus the read-only state of its daily check-in activity.
 *
 * The backend reports an absolute credit balance, not a usage window with a
 * reset schedule, so no reset label and no percentage meter are rendered. When
 * the balance is unknown the card shows "--" instead of a fabricated zero.
 *
 * The check-in row is observation only: claiming the reward is a user action in
 * the desktop client, so this card never offers a claim control.
 */

import { useTranslation } from 'react-i18next';
import type { LobsteraiServerQuotaState } from '@/types';
import type { QuotaBodyProps } from '../../types';

const formatCredits = (value: number): string =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function LobsteraiServerQuotaBody({
  quota,
  classes,
}: QuotaBodyProps<LobsteraiServerQuotaState>) {
  const { t } = useTranslation();
  if (quota.status !== 'success') {
    return <div className={classes.quotaMessage}>{t('lobsterai_server_quota.empty_data')}</div>;
  }

  const status = (quota.subscriptionStatus ?? '').trim().toLowerCase();
  const planLabel =
    status === ''
      ? t('lobsterai_server_quota.plan_unknown')
      : status === 'free'
        ? t('lobsterai_server_quota.plan_free')
        : t('lobsterai_server_quota.plan_subscribed');
  const creditsKnown = quota.creditsKnown === true;
  const credits = quota.credits ?? 0;
  const purchased = quota.purchasedCredits ?? 0;
  const activity = quota.activity;

  return (
    <>
      <div className={classes.codexPlan}>
        <span className={classes.codexPlanItem}>
          <span className={classes.codexPlanLabel}>
            {t('lobsterai_server_quota.plan_label')}
          </span>
          <span className={classes.codexPlanValue}>{planLabel}</span>
        </span>
      </div>
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t('lobsterai_server_quota.credits_row')}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaAmount}>
              {creditsKnown
                ? formatCredits(credits)
                : t('lobsterai_server_quota.credits_unknown')}
            </span>
          </div>
        </div>
      </div>
      {creditsKnown && purchased > 0 && (
        <div className={classes.quotaRow}>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>
              {t('lobsterai_server_quota.purchased_row')}
            </span>
            <div className={classes.quotaMeta}>
              <span className={classes.quotaAmount}>{formatCredits(purchased)}</span>
            </div>
          </div>
        </div>
      )}
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t('lobsterai_server_quota.checkin_row')}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaAmount}>
              {activity?.available
                ? t('lobsterai_server_quota.checkin_available')
                : t('lobsterai_server_quota.checkin_none')}
            </span>
          </div>
        </div>
      </div>
      {activity?.available && (
        <div className={classes.quotaRow}>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaMessage}>
              {t('lobsterai_server_quota.checkin_hint')}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
