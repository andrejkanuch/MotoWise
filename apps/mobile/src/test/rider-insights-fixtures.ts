/**
 * Rider insights responses for the screen tests, shaped like the API's
 * `riderInsights` payload (season 2026, read 2026-11-09).
 */
import { type GetRiderInsightsQuery, RiderInsightsStatus } from '@motovault/graphql';

export type InsightsPayload = GetRiderInsightsQuery['riderInsights'];

/** Encoded polylines (precision 5) around Logroño and around Bratislava. */
export const RIOJA_ROUTE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
export const BRATISLAVA_ROUTE = 'oqrfHqnvaBqAoCiAkC';

const LOCKED_TEASER_GRID = [
  [0, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 0],
  [2, 1, 0, 0],
  [3, 2, 0, 0],
];

const READY_GRID = [
  [0, 0, 0, 0],
  [0, 2, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 0],
  [4, 2, 0, 0],
  [9, 4, 0, 0],
];

const base: InsightsPayload = {
  isPro: false,
  season: { from: '2026-01-01', to: '2026-11-09' },
  totals: { rides: 36, distanceM: 2_507_000, countries: 2 },
  coverage: {
    rides: 36,
    qualifyingRides: 20,
    pendingRides: 0,
    pendingRecentRides: 0,
    ridesWithBike: 35,
    qualifying: {
      withStats: 20,
      withRoute: 20,
      withWaypoints: 18,
      withBands: 18,
      withLean: 16,
      withMovingTime: 18,
    },
  },
  latestRide: {
    rideId: '00000000-0000-4000-8000-000000000036',
    localDate: '2026-11-08',
    distanceM: 64_000,
    newCountries: [],
  },
  longestRide: {
    rideId: '00000000-0000-4000-8000-000000000008',
    name: 'Weekend Tatras Tour',
    localDate: '2026-03-08',
    distanceM: 385_000,
    movingTimeS: 21_600,
    durationS: 25_200,
    startPlace: 'Bratislava',
    endPlace: 'Bratislava',
  },
  ribbon: [
    { weekStart: '2026-03-02', rides: 3, distanceM: 385_000 },
    { weekStart: '2026-11-02', rides: 1, distanceM: 64_000 },
  ],
  regions: [
    {
      key: 'ES.27',
      isoA2: 'ES',
      name: 'La Rioja',
      rides: 13,
      distanceM: 1_324_000,
      bounds: [-3.1, 42.0, -1.7, 42.6],
      routes: [RIOJA_ROUTE],
    },
    {
      key: 'SK.02',
      isoA2: 'SK',
      name: 'Bratislava',
      rides: 9,
      distanceM: 805_000,
      bounds: [16.9, 47.9, 20.3, 49.3],
      routes: [BRATISLAVA_ROUTE],
    },
  ],
  countries: [
    {
      isoA2: 'ES',
      name: 'Spain',
      firstDate: '2026-04-01',
      firstRideId: '00000000-0000-4000-8000-000000000010',
      rides: 22,
      distanceM: 1_600_000,
    },
    {
      isoA2: 'SK',
      name: 'Slovakia',
      firstDate: '2026-01-10',
      firstRideId: '00000000-0000-4000-8000-000000000001',
      rides: 14,
      distanceM: 907_000,
    },
  ],
  bikes: {
    status: RiderInsightsStatus.Ready,
    items: [
      {
        motorcycleId: 'bike-gs',
        name: 'R 1250 GS',
        rides: 18,
        distanceM: 1_144_000,
        movingTimeS: 72_000,
      },
      {
        motorcycleId: 'bike-at',
        name: 'Africa Twin',
        rides: 17,
        distanceM: 1_118_000,
        movingTimeS: 70_000,
      },
      { motorcycleId: null, name: null, rides: 1, distanceM: 245_000, movingTimeS: 9_000 },
    ],
  },
  territory: { status: RiderInsightsStatus.Locked, headline: 340, detail: null },
  roadCharacter: {
    status: RiderInsightsStatus.Locked,
    headline: 21,
    teaser: { bandShares: { straight: 0.6, sweeping: 0.2, twisty: 0.1, tight: 0.1 } },
    detail: null,
  },
  rhythm: {
    status: RiderInsightsStatus.Locked,
    headline: 0.6,
    teaser: { grid: LOCKED_TEASER_GRID },
    detail: null,
  },
  bestRides: {
    status: RiderInsightsStatus.Locked,
    headline: 20,
    teaser: { count: 20 },
    detail: null,
  },
  costPerKm: { status: RiderInsightsStatus.Locked, items: null },
};

/** A free rider with 20 qualifying rides: every Pro group locked. */
export function freeInsights(overrides: Partial<InsightsPayload> = {}): InsightsPayload {
  return { ...base, ...overrides };
}

/** The same rider with Pro: every group ready with its detail. */
export function proInsights(): InsightsPayload {
  return {
    ...base,
    isPro: true,
    territory: {
      status: RiderInsightsStatus.Ready,
      headline: null,
      detail: {
        exploredCells: 3_200,
        exploredKm2: 343,
        routedM: 2_400_000,
        newRoadM: 2_016_000,
        newRoadShare: 0.84,
        furthest: {
          rideId: '00000000-0000-4000-8000-000000000008',
          name: 'Tatra loop',
          localDate: '2026-03-08',
          distanceM: 255_000,
          lat: 49.1,
          lng: 20.1,
        },
      },
    },
    roadCharacter: {
      status: RiderInsightsStatus.Ready,
      headline: null,
      teaser: null,
      detail: {
        routedKm: 2_400,
        bendsCount: 5_000,
        bendsPer10km: 20.8,
        ridesWithBands: 18,
        ridesWithLean: 16,
        bandKm: { straight: 1_325, sweeping: 456, twisty: 314, tight: 305 },
        twistiest: [],
        straightest: [],
        lean: { corners: 900, under20: 0.6, from20to30: 0.3, from30to40: 0.08, from40: 0.02 },
      },
    },
    rhythm: {
      status: RiderInsightsStatus.Ready,
      headline: null,
      teaser: null,
      detail: {
        grid: READY_GRID,
        rides: 31,
        weekendRides: 18,
        weekendShare: 0.58,
        medianDistanceM: 62_000,
        medianMovingTimeS: 4_200,
        ridesWithMovingTime: 30,
      },
    },
    bestRides: {
      status: RiderInsightsStatus.Ready,
      headline: null,
      teaser: null,
      detail: { count: 20, byDistance: [], byClimb: [], byBends: [] },
    },
  };
}

/** A rider with 4 qualifying rides: every Pro group not enough. */
export function newRiderInsights(): InsightsPayload {
  const notEnough = RiderInsightsStatus.NotEnough;
  return {
    ...base,
    totals: { rides: 4, distanceM: 210_000, countries: 1 },
    coverage: { ...base.coverage, rides: 4, qualifyingRides: 4 },
    territory: { status: notEnough, headline: null, detail: null },
    roadCharacter: { status: notEnough, headline: null, teaser: null, detail: null },
    rhythm: { status: notEnough, headline: null, teaser: null, detail: null },
    bestRides: { status: notEnough, headline: null, teaser: null, detail: null },
  };
}

/** Right after the update: rides exist but their stats are not computed yet. */
export function computingInsights(): InsightsPayload {
  const computing = RiderInsightsStatus.Computing;
  return {
    ...base,
    coverage: { ...base.coverage, pendingRides: 20, pendingRecentRides: 20 },
    territory: { status: computing, headline: null, detail: null },
    roadCharacter: { status: computing, headline: null, teaser: null, detail: null },
    rhythm: { status: computing, headline: null, teaser: null, detail: null },
    bestRides: { status: computing, headline: null, teaser: null, detail: null },
  };
}
