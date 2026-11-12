import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTierCache } from '../../common/entitlements/resolve-tier';
import { FREE_ROW, fakeAdmin, PRO_ROW } from '../rider-insights/__fixtures__/fake-admin';
import { type CostTrendRow, CostTrendService, EXPENSE_COST_TREND_RPC } from './cost-trend.service';

const USER = '9d3b1a2c-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const BIKE = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const months = (totals: number[]) =>
  totals.map((total, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, total }));

/** Two currencies in the window: 4 EUR expenses and 1 USD expense. */
const ROW: CostTrendRow = {
  from_month: '2026-01',
  to_month: '2026-12',
  expense_count: 5,
  series: [
    {
      currency: 'EUR',
      expense_count: 4,
      total: 431.47,
      months: months([0, 0, 120.5, 0, 0, 0, 90.97, 0, 0, 0, 220, 0]),
    },
    {
      currency: 'USD',
      expense_count: 1,
      total: 63.21,
      months: months([0, 0, 0, 0, 0, 63.21, 0, 0, 0, 0, 0, 0]),
    },
  ],
};

const EMPTY_ROW: CostTrendRow = {
  from_month: '2026-01',
  to_month: '2026-12',
  expense_count: 0,
  series: [],
};

function userClient(answer: () => { data: unknown; error: unknown }) {
  const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => answer());
  return { client: { rpc } as never, rpc };
}

function service(
  admin: ReturnType<typeof fakeAdmin>,
  user: ReturnType<typeof userClient>,
  revenueCat: object = {},
) {
  return new CostTrendService(user.client, admin.client, revenueCat as never);
}

beforeEach(() => {
  clearTierCache();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('CostTrendService.getCostTrend', () => {
  it('calls the RPC on the user client with the requested zone and a 12-month window', async () => {
    const admin = fakeAdmin({ tierRow: PRO_ROW });
    const user = userClient(() => ({ data: ROW, error: null }));
    await service(admin, user).getCostTrend(USER, BIKE, { timeZone: 'Pacific/Auckland' });

    expect(user.rpc).toHaveBeenCalledWith(EXPENSE_COST_TREND_RPC, {
      p_motorcycle_id: BIKE,
      p_tz: 'Pacific/Auckland',
      p_months: 12,
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('falls back to the zone of the latest ride, then UTC', async () => {
    const withRide = fakeAdmin({ tierRow: FREE_ROW, latestZone: 'Europe/Madrid' });
    const user = userClient(() => ({ data: ROW, error: null }));
    const fromRide = await service(withRide, user).getCostTrend(USER, BIKE, {
      timeZone: 'Not/AZone',
    });
    expect(fromRide.timeZone).toBe('Europe/Madrid');

    const noRide = fakeAdmin({ tierRow: FREE_ROW });
    const fallback = await service(noRide, user).getCostTrend(USER, BIKE);
    expect(fallback.timeZone).toBe('UTC');
    expect(user.rpc).toHaveBeenLastCalledWith(
      EXPENSE_COST_TREND_RPC,
      expect.objectContaining({ p_tz: 'UTC' }),
    );
  });

  it('gives a Pro rider every series, most expenses first, and no locked section', async () => {
    const admin = fakeAdmin({ tierRow: PRO_ROW });
    const user = userClient(() => ({ data: ROW, error: null }));
    const trend = await service(admin, user).getCostTrend(USER, BIKE, { timeZone: 'UTC' });

    expect(trend).toMatchObject({
      isPro: true,
      fromMonth: '2026-01',
      toMonth: '2026-12',
      expenseCount: 5,
      currency: 'EUR',
      otherCurrencyExpenseCount: 1,
      lockedSections: [],
    });
    expect(trend.series?.map((s) => [s.currency, s.expenseCount, s.total])).toEqual([
      ['EUR', 4, 431.47],
      ['USD', 1, 63.21],
    ]);
    expect(trend.series?.[0].months).toHaveLength(12);
  });

  it('gives a free rider the headline and the locked section names, and no money figure', async () => {
    const admin = fakeAdmin({ tierRow: FREE_ROW });
    const user = userClient(() => ({ data: ROW, error: null }));
    const trend = await service(admin, user).getCostTrend(USER, BIKE, { timeZone: 'UTC' });

    expect(trend).toEqual({
      isPro: false,
      timeZone: 'UTC',
      fromMonth: '2026-01',
      toMonth: '2026-12',
      expenseCount: 5,
      currency: 'EUR',
      otherCurrencyExpenseCount: 1,
      lockedSections: ['monthly_totals', 'period_totals'],
      series: null,
    });
    const recorded = JSON.stringify(trend);
    for (const amount of ['431.47', '63.21', '120.5', '90.97', '220']) {
      expect(recorded).not.toContain(amount);
    }
  });

  it('a rider with no expenses in the window gets no currency and empty series', async () => {
    const admin = fakeAdmin({ tierRow: PRO_ROW });
    const user = userClient(() => ({ data: EMPTY_ROW, error: null }));
    const trend = await service(admin, user).getCostTrend(USER, BIKE, { timeZone: 'UTC' });

    expect(trend).toMatchObject({
      expenseCount: 0,
      currency: null,
      otherCurrencyExpenseCount: 0,
      series: [],
    });
  });

  it('re-reads RevenueCat before the tier when refreshEntitlement is set', async () => {
    const order: string[] = [];
    const admin = fakeAdmin({ tierRow: FREE_ROW, onRead: (what) => order.push(what) });
    const user = userClient(() => ({ data: ROW, error: null }));
    const fetchSubscriberEntitlements = vi.fn(async () => {
      order.push('revenuecat');
      return { isPro: false };
    });
    await service(admin, user, { fetchSubscriberEntitlements }).getCostTrend(USER, BIKE, {
      timeZone: 'UTC',
      refreshEntitlement: true,
    });

    expect(fetchSubscriberEntitlements).toHaveBeenCalledWith(USER);
    expect(order.indexOf('revenuecat')).toBeLessThan(order.indexOf('users'));
  });

  it('fails when the RPC fails, rather than returning an empty trend', async () => {
    const admin = fakeAdmin({ tierRow: PRO_ROW });
    const user = userClient(() => ({ data: null, error: { message: 'boom', code: 'XX000' } }));
    await expect(
      service(admin, user).getCostTrend(USER, BIKE, { timeZone: 'UTC' }),
    ).rejects.toThrow();
  });
});
