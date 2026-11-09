import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTierCache, confirmPro, resolveTier } from '../../common/entitlements/resolve-tier';
import { FREE_ROW, fakeAdmin, PRO_ROW } from './__fixtures__/fake-admin';
import { PRO_ONLY_VALUES, seasonRow, seasonWithCoverage } from './__fixtures__/season-row';
import { RiderInsightsService } from './rider-insights.service';
import { RIDER_INSIGHTS_SEASON_RPC, type SeasonRow } from './rider-insights.types';

const USER = '9d3b1a2c-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

function service(admin: ReturnType<typeof fakeAdmin>, revenueCat: object = {}) {
  return new RiderInsightsService(admin.client, revenueCat as never);
}

/** A season RPC answering per window start year. */
const byYear = (rows: Record<string, SeasonRow>) => (args: Record<string, unknown>) =>
  rows[String(args.p_from).slice(0, 4)];

beforeEach(() => {
  clearTierCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('RiderInsightsService.getRiderInsights', () => {
  it('reads the season for this rider only, with every group, after resolving the tier', async () => {
    const order: string[] = [];
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      latestZone: 'Europe/Madrid',
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: () => seasonRow() },
      onRead: (what) => order.push(what),
    });
    await service(admin).getRiderInsights(USER);

    expect(admin.rpcCalls).toEqual([
      {
        name: RIDER_INSIGHTS_SEASON_RPC,
        args: {
          p_user_id: USER,
          p_from: '2026-01-01',
          p_to: '2026-12-31',
          p_groups: ['territory', 'road_character', 'rhythm', 'best_rides', 'bikes', 'countries'],
          p_tolerance: 25,
        },
      },
    ]);
    expect(order.indexOf('users')).toBeLessThan(order.indexOf(`rpc:${RIDER_INSIGHTS_SEASON_RPC}`));
  });

  it('a recorded free response validates, locks every Pro group and holds no exact Pro value', async () => {
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: () => seasonRow() },
    });
    const recorded = JSON.stringify(await service(admin).getRiderInsights(USER));

    const response = JSON.parse(recorded);
    for (const group of ['territory', 'roadCharacter', 'rhythm', 'bestRides', 'costPerKm']) {
      expect(response[group].status).toBe('locked');
    }
    expect(Object.keys(response.territory).sort()).toEqual(['headline', 'status']);
    expect(Object.keys(response.roadCharacter).sort()).toEqual(['headline', 'status', 'teaser']);
    const exact = [
      PRO_ONLY_VALUES.exploredKm2,
      PRO_ONLY_VALUES.newRoadShare,
      PRO_ONLY_VALUES.bendsPer10km,
      PRO_ONLY_VALUES.weekendShare,
      PRO_ONLY_VALUES.medianDistanceM,
      PRO_ONLY_VALUES.costPerKm,
      PRO_ONLY_VALUES.furthestLat,
      ...Object.values(PRO_ONLY_VALUES.bandKm),
    ];
    for (const value of exact) expect(recorded).not.toContain(String(value));
  });

  it('gives a Pro rider full detail', async () => {
    const admin = fakeAdmin({
      tierRow: PRO_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: () => seasonRow() },
    });
    const insights = await service(admin).getRiderInsights(USER);
    expect(insights.isPro).toBe(true);
    expect(insights.territory).toMatchObject({ status: 'ready', detail: { exploredKm2: 125.03 } });
  });

  it('gives a rider with 4 qualifying rides not_enough for every Pro group', async () => {
    const four = seasonWithCoverage({ qualifying_rides: 4 });
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: byYear({ '2026': four, '2025': four }) },
    });
    const insights = await service(admin).getRiderInsights(USER);
    for (const group of ['territory', 'roadCharacter', 'rhythm', 'bestRides'] as const) {
      expect(insights[group]).toEqual({ status: 'not_enough' });
    }
  });

  it('refreshEntitlement unlocks a webhook-lagged purchase and the guard then reads Pro', async () => {
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: () => seasonRow() },
    });
    // The real subscriber read writes a confirmed Pro into the shared tier cache.
    const fetchSubscriberEntitlements = vi.fn(async (userId: string) => {
      confirmPro(userId);
      return { isPro: true, state: null };
    });
    const insightsService = service(admin, { fetchSubscriberEntitlements });

    // Before the refresh the users row (still free) is cached for the guard.
    const before = await insightsService.getRiderInsights(USER);
    expect(before.territory.status).toBe('locked');

    const after = await insightsService.getRiderInsights(USER, { refreshEntitlement: true });
    expect(fetchSubscriberEntitlements).toHaveBeenCalledWith(USER);
    expect(after.territory.status).toBe('ready');
    expect(await resolveTier(admin.client, USER)).toBe('pro');
  });

  it('does not ask RevenueCat without refreshEntitlement', async () => {
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: () => seasonRow() },
    });
    const fetchSubscriberEntitlements = vi.fn();
    await service(admin, { fetchSubscriberEntitlements }).getRiderInsights(USER);
    expect(fetchSubscriberEntitlements).not.toHaveBeenCalled();
  });
});

describe('RiderInsightsService season choice', () => {
  const fivePlus = seasonRow();
  const twoNew = seasonWithCoverage({ rides: 2, qualifying_rides: 2 });

  it('shows the current year in the rider latest zone once it has five qualifying rides', async () => {
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      // 2026-11-09T12:00Z is already 2026 everywhere; the year comes from the zone's date.
      latestZone: 'Pacific/Kiritimati',
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: byYear({ '2026': fivePlus }) },
    });
    const insights = await service(admin).getRiderInsights(USER);
    expect(admin.rpcCalls).toHaveLength(1);
    expect(insights.season).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('keeps the previous year while the new one has fewer than five qualifying rides', async () => {
    vi.setSystemTime(new Date('2027-02-01T12:00:00Z'));
    const previous = { ...seasonRow(), window: { from: '2026-01-01', to: '2026-12-31' } };
    const current = { ...twoNew, window: { from: '2027-01-01', to: '2027-12-31' } };
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: byYear({ '2027': current, '2026': previous }) },
    });
    const insights = await service(admin).getRiderInsights(USER, { timeZone: 'Europe/Madrid' });
    expect(admin.rpcCalls.map((c) => c.args.p_from)).toEqual(['2027-01-01', '2026-01-01']);
    expect(insights.season.from).toBe('2026-01-01');
    expect(insights.territory.status).toBe('locked');
  });

  it('shows the current year to a new rider with no previous season', async () => {
    const empty = seasonWithCoverage({ rides: 0, qualifying_rides: 0 });
    const current = { ...twoNew, window: { from: '2026-01-01', to: '2026-12-31' } };
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: byYear({ '2026': current, '2025': empty }) },
    });
    const insights = await service(admin).getRiderInsights(USER);
    expect(insights.season.from).toBe('2026-01-01');
    expect(insights.territory).toEqual({ status: 'not_enough' });
  });

  it('reads the new year in the requested zone even while it is still the old year in UTC', async () => {
    vi.setSystemTime(new Date('2026-12-31T20:00:00Z')); // 2027-01-01 09:00 in Auckland
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      latestZone: 'Europe/Madrid',
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: byYear({ '2027': fivePlus }) },
    });
    await service(admin).getRiderInsights(USER, { timeZone: 'Pacific/Auckland' });
    expect(admin.rpcCalls[0].args.p_from).toBe('2027-01-01');
  });

  it('passes an explicit window through and rejects a half or reversed one', async () => {
    const admin = fakeAdmin({
      tierRow: FREE_ROW,
      rpc: { [RIDER_INSIGHTS_SEASON_RPC]: () => seasonRow() },
    });
    const insightsService = service(admin);
    await insightsService.getRiderInsights(USER, { from: '2026-03-01', to: '2026-09-30' });
    expect(admin.rpcCalls[0].args).toMatchObject({ p_from: '2026-03-01', p_to: '2026-09-30' });

    await expect(insightsService.getRiderInsights(USER, { from: '2026-03-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      insightsService.getRiderInsights(USER, { from: '2026-09-30', to: '2026-03-01' }),
    ).rejects.toThrow(BadRequestException);
  });
});
