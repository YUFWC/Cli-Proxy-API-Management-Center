/**
 * LobsterAI quota mapping tests.
 *
 * The backend reports an absolute credit balance, not a usage window. The
 * important invariant is that a balance the backend did not measure stays
 * UNKNOWN (`creditsKnown: false`): rendering an omitted balance as 0 would say
 * "exhausted". The check-in activity is reported as observed state only, and a
 * missing balance must not suppress a readable plan/activity.
 */

import { describe, expect, test } from 'bun:test';
import { buildLobsteraiServerQuotaData } from '@/features/quota/providers/lobsteraiserver/data';
import { parseLobsteraiServerQuotaPayload } from '@/services/api/lobsteraiServerQuota';

describe('lobsterai-server quota payload parsing', () => {
  test('normalizes a full payload', () => {
    const parsed = parseLobsteraiServerQuotaPayload({
      subscription_status: 'active',
      credits: 42,
      credits_known: true,
      purchased_credits: 10,
      activity_available: true,
      activity_code: 'daily_check_in',
      activity_template: 'native_daily_check_in_v1',
      activity_placement: 'desktop_sidebar',
      activity_context: { progress: '1/7' },
    });
    expect(parsed).toEqual({
      subscription_status: 'active',
      credits: 42,
      credits_known: true,
      purchased_credits: 10,
      activity_available: true,
      activity_code: 'daily_check_in',
      activity_template: 'native_daily_check_in_v1',
      activity_placement: 'desktop_sidebar',
      activity_context: { progress: '1/7' },
    });
  });

  test('keeps the plan when the balance is unknown', () => {
    // A backend that reports only the plan is still useful.
    const parsed = parseLobsteraiServerQuotaPayload({ subscription_status: 'free' });
    expect(parsed).not.toBeNull();
    expect(parsed?.credits_known).toBe(false);
    expect(parsed?.credits).toBeUndefined();
    expect(parsed?.subscription_status).toBe('free');
  });

  test('keeps the activity state when the balance is unknown', () => {
    const parsed = parseLobsteraiServerQuotaPayload({
      activity_available: true,
      activity_code: 'daily_check_in',
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.activity_available).toBe(true);
    expect(parsed?.credits_known).toBe(false);
  });

  test('rejects a payload carrying no usable field', () => {
    expect(parseLobsteraiServerQuotaPayload({})).toBeNull();
    expect(parseLobsteraiServerQuotaPayload({ credits_known: true })).toBeNull();
    expect(parseLobsteraiServerQuotaPayload(null)).toBeNull();
    expect(parseLobsteraiServerQuotaPayload('nope')).toBeNull();
  });

  test('defaults credits_known to false unless explicitly true', () => {
    expect(parseLobsteraiServerQuotaPayload({ credits: 5 })?.credits_known).toBe(false);
    expect(
      parseLobsteraiServerQuotaPayload({ credits: 5, credits_known: 'yes' })?.credits_known
    ).toBe(false);
  });

  test('accepts a numeric string balance', () => {
    const parsed = parseLobsteraiServerQuotaPayload({ credits: '17', credits_known: true });
    expect(parsed?.credits).toBe(17);
  });
});

describe('lobsterai-server quota view model', () => {
  test('carries a measured balance and the activity through', () => {
    const data = buildLobsteraiServerQuotaData({
      subscription_status: 'free',
      credits: 12,
      credits_known: true,
      purchased_credits: 3,
      activity_available: true,
      activity_code: 'daily_check_in',
    });
    expect(data.creditsKnown).toBe(true);
    expect(data.credits).toBe(12);
    expect(data.purchasedCredits).toBe(3);
    expect(data.subscriptionStatus).toBe('free');
    expect(data.activity.available).toBe(true);
    expect(data.activity.code).toBe('daily_check_in');
  });

  test('marks an unreported balance as unknown', () => {
    const data = buildLobsteraiServerQuotaData({ subscription_status: 'free' });
    expect(data.creditsKnown).toBe(false);
    expect(data.activity.available).toBe(false);
  });
});
