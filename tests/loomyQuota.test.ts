/**
 * Loomy quota mapping tests.
 *
 * Loomy reports two independent points pools. The important invariants are:
 *   - a balance the backend did not report stays UNKNOWN, never zero;
 *   - the daily cap is optional because the read endpoint does not return it,
 *     so a missing cap must not be rendered as "0 / 0";
 *   - the two pools are never summed into one number that hides which pool the
 *     next request draws from.
 */

import { describe, expect, test } from 'bun:test';
import { buildLoomyQuotaData } from '@/features/quota/providers/loomy/data';
import { parseLoomyQuotaPayload } from '@/services/api/loomy';

describe('loomy quota payload parsing', () => {
  test('normalizes a full payload', () => {
    expect(
      parseLoomyQuotaPayload({
        permanent: 15000,
        daily: 4992,
        total: 19992,
        daily_quota: 5000,
        daily_consumed: 8,
        daily_cycle_date: '2026-10-20',
      })
    ).toEqual({
      permanent: 15000,
      daily: 4992,
      total: 19992,
      daily_quota: 5000,
      daily_consumed: 8,
      daily_cycle_date: '2026-10-20',
    });
  });

  test('keeps the pools when the daily window is not reported', () => {
    // The read-only endpoint omits the daily cap and consumption; the balances
    // are still useful and must survive.
    expect(parseLoomyQuotaPayload({ permanent: 15000, daily: 4992, total: 19992 })).toEqual({
      permanent: 15000,
      daily: 4992,
      total: 19992,
      daily_quota: undefined,
      daily_consumed: undefined,
      daily_cycle_date: undefined,
    });
  });

  test('rejects a payload without an anchor balance', () => {
    // A response with no usable balance must surface as a read failure rather
    // than a card showing zero points.
    expect(parseLoomyQuotaPayload({ daily: 4992 })).toBeNull();
    expect(parseLoomyQuotaPayload({ permanent: 15000 })).toBeNull();
    expect(parseLoomyQuotaPayload(null)).toBeNull();
    expect(parseLoomyQuotaPayload('nope')).toBeNull();
  });

  test('reads numeric strings', () => {
    expect(parseLoomyQuotaPayload({ permanent: '15000', daily: '4992', total: '19992' })).toEqual({
      permanent: 15000,
      daily: 4992,
      total: 19992,
      daily_quota: undefined,
      daily_consumed: undefined,
      daily_cycle_date: undefined,
    });
  });
});

describe('loomy quota view model', () => {
  test('carries the optional daily window through unchanged', () => {
    expect(
      buildLoomyQuotaData({
        permanent: 15000,
        daily: 4992,
        total: 19992,
        daily_quota: 5000,
        daily_consumed: 8,
        daily_cycle_date: '2026-10-20',
      })
    ).toEqual({
      permanent: 15000,
      daily: 4992,
      total: 19992,
      dailyQuota: 5000,
      dailyConsumed: 8,
      dailyCycleDate: '2026-10-20',
    });
  });

  test('omits absent daily fields instead of substituting zero', () => {
    const data = buildLoomyQuotaData({ permanent: 15000, daily: 4992, total: 19992 });
    expect(data.dailyQuota).toBeUndefined();
    expect(data.dailyConsumed).toBeUndefined();
    expect('dailyQuota' in data).toBe(false);
    expect('dailyConsumed' in data).toBe(false);
  });
});
