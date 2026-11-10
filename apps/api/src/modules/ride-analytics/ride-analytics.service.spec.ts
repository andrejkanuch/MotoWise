import { describe, expect, it } from 'vitest';
import { fakeAdmin } from '../rider-insights/__fixtures__/fake-admin';
import { type OverviewRow, RIDER_RIDE_OVERVIEW_RPC } from '../rider-insights/rider-insights.types';
import { RideAnalyticsService } from './ride-analytics.service';

const USER = '9d3b1a2c-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const RIDE_ID = '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d06';

const period = { rideCount: 2, distanceM: 81_500, durationS: 7_200 };

const overviewRow: OverviewRow = {
  lastRide: {
    id: RIDE_ID,
    distanceM: 41_000,
    durationS: 3_600,
    maxSpeedMps: null,
    date: '2026-11-08T17:00:00+00:00',
    motorcycleName: null,
    summaryTitle: 'Evening loop',
  },
  last7Days: period,
  last30Days: period,
  thisWeek: period,
  thisMonth: period,
  dailyDistances: [{ date: '2026-11-08', distanceM: 41_000 }],
  currentStreak: 3,
  personalRecords: [
    {
      recordType: 'longest_distance',
      value: 312_000,
      unit: 'm',
      achievedAt: '2026-07-04T18:00:00+00:00',
      previousValue: null,
      rideId: RIDE_ID,
    },
  ],
};

function setup(latestZone: string | null) {
  const admin = fakeAdmin({ latestZone, rpc: { [RIDER_RIDE_OVERVIEW_RPC]: () => overviewRow } });
  return { admin, service: new RideAnalyticsService(admin.client) };
}

describe('RideAnalyticsService.getRideOverview', () => {
  it('reads the overview RPC in the requested zone for this rider', async () => {
    const { admin, service } = setup('Europe/Madrid');
    await service.getRideOverview(USER, 'America/Denver');
    expect(admin.rpcCalls).toEqual([
      { name: RIDER_RIDE_OVERVIEW_RPC, args: { p_user_id: USER, p_tz: 'America/Denver' } },
    ]);
  });

  it('without a zone uses the latest ride zone and returns the same shape', async () => {
    const { admin, service } = setup('Europe/Madrid');
    const overview = await service.getRideOverview(USER);
    expect(admin.rpcCalls[0].args.p_tz).toBe('Europe/Madrid');
    expect(overview).toEqual({
      lastRide: {
        id: RIDE_ID,
        distanceM: 41_000,
        durationS: 3_600,
        maxSpeedMps: undefined,
        date: '2026-11-08T17:00:00+00:00',
        motorcycleName: undefined,
        summaryTitle: 'Evening loop',
      },
      last7Days: period,
      last30Days: period,
      thisWeek: period,
      thisMonth: period,
      dailyDistances: [{ date: '2026-11-08', distanceM: 41_000 }],
      currentStreak: 3,
      personalRecords: [
        {
          recordType: 'longest_distance',
          value: 312_000,
          unit: 'm',
          achievedAt: '2026-07-04T18:00:00+00:00',
          previousValue: undefined,
          rideId: RIDE_ID,
        },
      ],
    });
  });

  it('falls back to UTC with no known zone, and for a zone that is not IANA', async () => {
    const { admin, service } = setup(null);
    await service.getRideOverview(USER);
    await service.getRideOverview(USER, '+02:00');
    expect(admin.rpcCalls.map((c) => c.args.p_tz)).toEqual(['UTC', 'UTC']);
  });

  it('maps a rider with no rides to no lastRide', async () => {
    const admin = fakeAdmin({
      rpc: {
        [RIDER_RIDE_OVERVIEW_RPC]: () => ({ ...overviewRow, lastRide: null, personalRecords: [] }),
      },
    });
    const overview = await new RideAnalyticsService(admin.client).getRideOverview(USER, 'UTC');
    expect(overview.lastRide).toBeUndefined();
    expect(overview.personalRecords).toEqual([]);
  });
});
