import { RIDER_INSIGHTS_STATUS, RiderInsightsSchema } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import {
  BIKE_ID,
  PRO_ONLY_VALUES,
  RIDE,
  seasonRow,
  seasonWithCoverage,
} from './__fixtures__/season-row';
import { buildRiderInsights } from './build-rider-insights';

const FREE = false;
const PRO = true;
const PRO_GROUPS = ['territory', 'roadCharacter', 'rhythm', 'bestRides', 'costPerKm'] as const;

describe('buildRiderInsights: a free rider with 13 computed qualifying rides', () => {
  const insights = buildRiderInsights(seasonRow(), FREE);

  it('locks every Pro group to one rounded headline plus its teaser and nothing else', () => {
    expect(insights.territory).toEqual({ status: 'locked', headline: 130 });
    expect(insights.roadCharacter).toEqual({
      status: 'locked',
      headline: 77,
      // 401.113, 287.311, 171.093 and 51.72 of 911.237 routed km, to the nearest 10%.
      teaser: { bandShares: { straight: 0.4, sweeping: 0.3, twisty: 0.2, tight: 0.1 } },
    });
    expect(insights.rhythm).toEqual({
      status: 'locked',
      headline: 0.6,
      // Counts scaled to the busiest slot (Saturday morning, 4 rides): 1 -> 1, 2 -> 2, 4 -> 3.
      teaser: {
        grid: [
          [0, 1, 1, 0],
          [0, 0, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 0],
          [0, 1, 1, 0],
          [3, 1, 0, 0],
          [2, 1, 0, 0],
        ],
      },
    });
    expect(insights.bestRides).toEqual({ status: 'locked', headline: 13, teaser: { count: 13 } });
    expect(insights.costPerKm).toEqual({ status: 'locked' });
  });

  it('validates against the strict contract', () => {
    expect(RiderInsightsSchema.safeParse(insights).success).toBe(true);
  });

  it('keeps the free blocks: totals, longest ride, bikes with Unassigned, countries and the map', () => {
    expect(insights.isPro).toBe(false);
    expect(insights.totals).toEqual({ rides: 13, distanceM: 921_400, countries: 2 });
    expect(insights.longestRide?.rideId).toBe(RIDE.LONG);
    expect(insights.bikes).toEqual({
      status: 'ready',
      items: [
        {
          motorcycleId: BIKE_ID,
          name: 'Africa Twin',
          rides: 12,
          distanceM: 880_000,
          movingTimeS: 60_000,
        },
        { motorcycleId: null, name: null, rides: 1, distanceM: 31_237, movingTimeS: 2_000 },
      ],
    });
    expect(insights.countries.map((c) => c.isoA2)).toEqual(['ES', 'FR']);
    expect(insights.regions[0]).toMatchObject({ key: 'ES.27', name: 'La Rioja' });
    expect(insights.regions[0].routes).toHaveLength(1);
  });

  it('carries no exact Pro value, Pro ride id or Pro-only list anywhere in the response', () => {
    const json = JSON.stringify(insights);
    const exactValues = [
      PRO_ONLY_VALUES.exploredCells,
      PRO_ONLY_VALUES.exploredKm2,
      PRO_ONLY_VALUES.routedM,
      PRO_ONLY_VALUES.newRoadM,
      PRO_ONLY_VALUES.newRoadShare,
      PRO_ONLY_VALUES.furthestLat,
      PRO_ONLY_VALUES.furthestLng,
      PRO_ONLY_VALUES.furthestDistanceM,
      PRO_ONLY_VALUES.furthestName,
      ...Object.values(PRO_ONLY_VALUES.bandKm),
      PRO_ONLY_VALUES.routedKm,
      PRO_ONLY_VALUES.bendsCount,
      PRO_ONLY_VALUES.bendsPer10km,
      PRO_ONLY_VALUES.leanCorners,
      PRO_ONLY_VALUES.leanUnder20,
      PRO_ONLY_VALUES.medianDistanceM,
      PRO_ONLY_VALUES.medianMovingTimeS,
      PRO_ONLY_VALUES.weekendShare,
      PRO_ONLY_VALUES.costPerKm,
      PRO_ONLY_VALUES.spend,
    ];
    for (const value of exactValues) expect(json).not.toContain(String(value));
    for (const id of [RIDE.TWISTY, RIDE.CLIMB, RIDE.FAR]) expect(json).not.toContain(id);
    for (const key of [
      'detail',
      'twistiest',
      'byClimb',
      'furthest',
      'lean',
      'items":[{"currency',
    ]) {
      expect(json).not.toContain(key);
    }
  });
});

describe('buildRiderInsights: a Pro rider', () => {
  it('gets full detail for every Pro group', () => {
    const insights = buildRiderInsights(seasonRow(), PRO);
    expect(insights.isPro).toBe(true);
    expect(insights.territory).toEqual({
      status: 'ready',
      headline: 130,
      detail: {
        exploredCells: 1187,
        exploredKm2: 125.03,
        routedM: 905_113,
        newRoadM: 402_119,
        newRoadShare: 0.4413,
        furthest: {
          rideId: RIDE.FAR,
          name: 'Cantabrian crossing',
          localDate: '2026-08-15',
          distanceM: 183_377,
          lat: 42.917_311,
          lng: -2.401_773,
        },
      },
    });
    expect(insights.roadCharacter).toMatchObject({
      status: 'ready',
      detail: {
        bandKm: { straight: 401.113, sweeping: 287.311, twisty: 171.093, tight: 51.72 },
        bendsPer10km: 76.96,
        twistiest: [{ rideId: RIDE.TWISTY, bendsPer10km: 131.17 }],
        lean: { corners: 3317, under20: 0.6113 },
      },
    });
    expect(insights.rhythm).toMatchObject({
      status: 'ready',
      detail: { weekendShare: 0.6154, medianDistanceM: 61_337.5, rides: 13 },
    });
    expect(insights.bestRides).toMatchObject({
      status: 'ready',
      detail: { count: 13, byBends: [{ rideId: RIDE.TWISTY }], byClimb: [{ rideId: RIDE.CLIMB }] },
    });
    expect(insights.costPerKm).toEqual({
      status: 'ready',
      items: [
        {
          currency: 'EUR',
          spend: 125.47,
          expenseCount: 7,
          distanceM: 921_400,
          distanceSource: 'tracked',
          costPerKm: 0.1377,
        },
      ],
    });
    expect(RiderInsightsSchema.safeParse(insights).success).toBe(true);
  });
});

describe('buildRiderInsights: status precedence', () => {
  it('gives not_enough to every Pro group below five qualifying rides, free or Pro', () => {
    const row = seasonWithCoverage({ qualifying_rides: 4 });
    for (const isPro of [FREE, PRO]) {
      const insights = buildRiderInsights(row, isPro);
      for (const group of PRO_GROUPS) expect(insights[group]).toEqual({ status: 'not_enough' });
    }
  });

  it('puts not_enough before computing', () => {
    const insights = buildRiderInsights(
      seasonWithCoverage({ qualifying_rides: 4, pending_rides: 2, pending_recent_rides: 2 }),
      FREE,
    );
    expect(insights.territory).toEqual({ status: RIDER_INSIGHTS_STATUS.NOT_ENOUGH });
  });

  it('gives computing with no headline while a ride that ended within 24 hours has no stats row', () => {
    const insights = buildRiderInsights(
      seasonWithCoverage({ pending_rides: 1, pending_recent_rides: 1 }),
      FREE,
    );
    for (const group of PRO_GROUPS) expect(insights[group]).toEqual({ status: 'computing' });
    // The free totals still show.
    expect(insights.totals.rides).toBe(13);
  });

  it('does not hold the season in computing for a ride whose stats never came (ended over 24 hours ago)', () => {
    const row = seasonWithCoverage({ pending_rides: 1, pending_recent_rides: 0 });
    const free = buildRiderInsights(row, FREE);
    for (const group of PRO_GROUPS) expect(free[group].status).toBe('locked');
    const pro = buildRiderInsights(row, PRO);
    for (const group of PRO_GROUPS) expect(pro[group].status).toBe('ready');
    // Coverage still reports every pending ride.
    expect(pro.coverage.pendingRides).toBe(1);
  });

  it('serves ready values when every ride has a stats row, whatever its stats version', () => {
    // The season read never looks at stats_version: rows from an older compute still
    // count as computed, so only a ride with no row at all makes a group computing.
    const insights = buildRiderInsights(seasonWithCoverage({ pending_rides: 0 }), PRO);
    for (const group of PRO_GROUPS) expect(insights[group].status).toBe('ready');
  });

  it('gives a free rider without route geometry missing_input for Territory and Road character, not a locked row', () => {
    const row = seasonWithCoverage({
      qualifying: { with_route: 0, with_bands: 0, with_waypoints: 0 },
    });
    const insights = buildRiderInsights(row, FREE);
    expect(insights.territory).toEqual({ status: 'missing_input' });
    expect(insights.roadCharacter).toEqual({ status: 'missing_input' });
    expect(insights.rhythm.status).toBe('locked');
  });

  it('gives Bikes missing_input when no ride has a bike', () => {
    const insights = buildRiderInsights(seasonWithCoverage({ rides_with_bike: 0 }), FREE);
    expect(insights.bikes).toEqual({ status: 'missing_input' });
  });

  it('gives cost per km missing_input when the season has no fuel or service spend', () => {
    const insights = buildRiderInsights({ ...seasonRow(), cost_per_km: [] }, PRO);
    expect(insights.costPerKm).toEqual({ status: 'missing_input' });
  });
});
