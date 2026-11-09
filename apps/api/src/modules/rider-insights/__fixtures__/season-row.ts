import type { SeasonRow } from '../rider-insights.types';

/**
 * A `rider_insights_season` payload in the RPC's documented shape, with every
 * detail group present: 13 qualifying rides in 2026, all computed. The exact
 * Pro values are deliberately odd numbers, so a test can search a response for
 * them and know a hit is a leak, not a coincidence.
 */

export const RIDE = {
  TWISTY: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d01',
  LONG: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d02',
  STRAIGHT: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d03',
  CLIMB: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d04',
  FAR: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d05',
  LATEST: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d06',
} as const;

export const BIKE_ID = '5b0c1d2e-3f40-4a51-8b62-7c83d94ea5f6';

/** Exact Pro values that must never appear in a free response. */
export const PRO_ONLY_VALUES = {
  exploredCells: 1187,
  exploredKm2: 125.03,
  routedM: 905_113,
  newRoadM: 402_119,
  newRoadShare: 0.4413,
  furthestLat: 42.917_311,
  furthestLng: -2.401_773,
  furthestDistanceM: 183_377,
  bandKm: { straight: 401.113, sweeping: 287.311, twisty: 171.093, tight: 51.72 },
  routedKm: 911.237,
  bendsCount: 7_013,
  bendsPer10km: 76.96,
  leanCorners: 3_317,
  leanUnder20: 0.6113,
  medianDistanceM: 61_337.5,
  medianMovingTimeS: 4_217.5,
  weekendShare: 0.6154,
  costPerKm: 0.1377,
  spend: 125.47,
} as const;

const ride = (id: string, localDate: string, distanceM: number, bends: number | null) => ({
  ride_id: id,
  name: `Ride ${localDate}`,
  local_date: localDate,
  distance_m: distanceM,
  climb_m: 1_311,
  bends_per_10km: bends,
  moving_time_s: 4_919,
});

export function seasonRow(overrides: Partial<SeasonRow> = {}): SeasonRow {
  const p = PRO_ONLY_VALUES;
  return {
    window: { from: '2026-01-01', to: '2026-12-31' },
    totals: { rides: 13, distance_m: 921_400, countries: 2 },
    coverage: {
      rides: 13,
      qualifying_rides: 13,
      pending_rides: 0,
      rides_with_bike: 12,
      qualifying: {
        with_stats: 13,
        with_route: 13,
        with_waypoints: 9,
        with_bands: 13,
        with_lean: 9,
        with_moving_time: 9,
      },
    },
    latest_ride: {
      ride_id: RIDE.LATEST,
      local_date: '2026-10-10',
      distance_m: 88_001,
      new_countries: ['FR'],
    },
    longest_ride: {
      ride_id: RIDE.LONG,
      name: 'Pyrenees loop',
      local_date: '2026-07-04',
      distance_m: 312_000,
      moving_time_s: 15_001,
      duration_s: 19_000,
      start_place: 'Logroño',
      end_place: 'Jaca',
    },
    ribbon: [
      { week_start: '2026-06-01', rides: 2, distance_m: 120_000 },
      { week_start: '2026-10-05', rides: 1, distance_m: 88_001 },
    ],
    regions: [
      {
        key: 'ES.27',
        iso_a2: 'ES',
        name: 'La Rioja',
        rides: 9,
        distance_m: 600_000,
        bounds: [-3.1, 41.9, -1.7, 42.7],
        routes: ['_p~iF~ps|U_ulLnnqC_mqNvxq`@'],
      },
    ],
    cost_per_km: [
      {
        currency: 'EUR',
        spend: p.spend,
        expense_count: 7,
        distance_m: 921_400,
        distance_source: 'tracked',
        cost_per_km: p.costPerKm,
      },
    ],
    groups: {
      territory: {
        explored_cells: p.exploredCells,
        explored_km2: p.exploredKm2,
        routed_m: p.routedM,
        new_road_m: p.newRoadM,
        new_road_share: p.newRoadShare,
        furthest: {
          ride_id: RIDE.FAR,
          local_date: '2026-08-15',
          distance_m: p.furthestDistanceM,
          lat: p.furthestLat,
          lng: p.furthestLng,
        },
      },
      road_character: {
        band_km: { ...p.bandKm },
        routed_km: p.routedKm,
        bends_count: p.bendsCount,
        bends_per_10km: p.bendsPer10km,
        rides_with_bands: 13,
        rides_with_lean: 9,
        twistiest: [
          {
            ride_id: RIDE.TWISTY,
            name: 'Ezcaray climbs',
            local_date: '2026-10-10',
            distance_m: 71_000,
            bends_per_10km: 131.17,
          },
        ],
        straightest: [
          {
            ride_id: RIDE.STRAIGHT,
            name: 'Ebro valley',
            local_date: '2026-05-02',
            distance_m: 94_000,
            bends_per_10km: 21.31,
          },
        ],
        lean: {
          corners: p.leanCorners,
          under20: p.leanUnder20,
          from20to30: 0.2711,
          from30to40: 0.1019,
          from40: 0.0157,
        },
      },
      rhythm: {
        // Monday..Sunday x morning, afternoon, evening, night.
        grid: [
          [0, 1, 1, 0],
          [0, 0, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 0],
          [0, 1, 1, 0],
          [4, 1, 0, 0],
          [2, 1, 0, 0],
        ],
        rides: 13,
        weekend_rides: 8,
        weekend_share: p.weekendShare,
        median_distance_m: p.medianDistanceM,
        median_moving_time_s: p.medianMovingTimeS,
        rides_with_moving_time: 9,
      },
      best_rides: {
        count: 13,
        by_distance: [ride(RIDE.LONG, '2026-07-04', 312_000, 31.07)],
        by_climb: [ride(RIDE.CLIMB, '2026-09-12', 140_000, 88.41)],
        by_bends: [ride(RIDE.TWISTY, '2026-10-10', 71_000, 131.17)],
      },
      bikes: {
        items: [
          {
            motorcycle_id: BIKE_ID,
            name: 'Africa Twin',
            rides: 12,
            distance_m: 880_000,
            moving_time_s: 60_000,
          },
          { motorcycle_id: null, name: null, rides: 1, distance_m: 31_237, moving_time_s: 2_000 },
        ],
      },
      countries: {
        items: [
          {
            iso_a2: 'ES',
            name: 'Spain',
            first_date: '2026-03-01',
            first_ride_id: RIDE.STRAIGHT,
            rides: 13,
            distance_m: 850_000,
          },
          {
            iso_a2: 'FR',
            name: 'France',
            first_date: '2026-10-10',
            first_ride_id: RIDE.LATEST,
            rides: 1,
            distance_m: 61_237,
          },
        ],
      },
    },
    ...overrides,
  };
}

/** `seasonRow()` with its coverage changed (counts merge into the fixture's). */
export function seasonWithCoverage(
  coverage: Partial<Omit<SeasonRow['coverage'], 'qualifying'>> & {
    qualifying?: Partial<SeasonRow['coverage']['qualifying']>;
  },
): SeasonRow {
  const base = seasonRow();
  return {
    ...base,
    coverage: {
      ...base.coverage,
      ...coverage,
      qualifying: { ...base.coverage.qualifying, ...coverage.qualifying },
    },
  };
}
