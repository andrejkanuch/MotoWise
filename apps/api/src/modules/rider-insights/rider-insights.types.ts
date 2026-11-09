/**
 * Shapes of the rider insights RPCs (migration 00199) at the query boundary.
 * `database.types.ts` lags production, so the service-role client is untyped
 * here and these interfaces are the contract. Keys are the RPC's snake_case.
 */

export const RIDER_INSIGHTS_SEASON_RPC = 'rider_insights_season';
export const RIDER_RIDE_OVERVIEW_RPC = 'rider_ride_overview';
export const RIDE_NEW_ROADS_RPC = 'ride_new_roads';

/** Douglas-Peucker tolerance, in metres, for the season map's region routes. */
export const RIDER_INSIGHTS_ROUTE_TOLERANCE_M = 25;

export interface SeasonRideRef {
  ride_id: string;
  name: string | null;
  local_date: string;
}

export interface SeasonRankedBendsRide extends SeasonRideRef {
  distance_m: number;
  bends_per_10km: number | null;
}

export interface SeasonBestRide extends SeasonRideRef {
  distance_m: number;
  climb_m: number | null;
  bends_per_10km: number | null;
  moving_time_s: number | null;
}

export interface SeasonBands {
  straight: number;
  sweeping: number;
  twisty: number;
  tight: number;
}

export interface SeasonTerritory {
  explored_cells: number;
  explored_km2: number;
  routed_m: number;
  new_road_m: number;
  new_road_share: number | null;
  furthest: {
    ride_id: string;
    local_date: string;
    distance_m: number;
    lat: number;
    lng: number;
  } | null;
}

export interface SeasonRoadCharacter {
  band_km: SeasonBands;
  routed_km: number;
  bends_count: number;
  bends_per_10km: number | null;
  rides_with_bands: number;
  rides_with_lean: number;
  twistiest: SeasonRankedBendsRide[];
  straightest: SeasonRankedBendsRide[];
  lean: {
    corners: number;
    under20: number;
    from20to30: number;
    from30to40: number;
    from40: number;
  } | null;
}

export interface SeasonRhythm {
  grid: number[][];
  rides: number;
  weekend_rides: number;
  weekend_share: number | null;
  median_distance_m: number | null;
  median_moving_time_s: number | null;
  rides_with_moving_time: number;
}

export interface SeasonBestRides {
  count: number;
  by_distance: SeasonBestRide[];
  by_climb: SeasonBestRide[];
  by_bends: SeasonBestRide[];
}

export interface SeasonBike {
  motorcycle_id: string | null;
  name: string | null;
  rides: number;
  distance_m: number;
  moving_time_s: number;
}

export interface SeasonCountry {
  iso_a2: string;
  name: string | null;
  first_date: string;
  first_ride_id: string;
  rides: number;
  distance_m: number;
}

export interface SeasonCostPerKm {
  currency: string;
  spend: number;
  expense_count: number;
  distance_m: number;
  distance_source: string;
  cost_per_km: number | null;
}

/** `rider_insights_season` with every detail group requested. */
export interface SeasonRow {
  window: { from: string; to: string };
  totals: { rides: number; distance_m: number; countries: number };
  coverage: {
    rides: number;
    qualifying_rides: number;
    pending_rides: number;
    rides_with_bike: number;
    qualifying: {
      with_stats: number;
      with_route: number;
      with_waypoints: number;
      with_bands: number;
      with_lean: number;
      with_moving_time: number;
    };
  };
  latest_ride: {
    ride_id: string;
    local_date: string;
    distance_m: number;
    new_countries: string[];
  } | null;
  longest_ride:
    | (SeasonRideRef & {
        distance_m: number;
        moving_time_s: number | null;
        duration_s: number;
        start_place: string | null;
        end_place: string | null;
      })
    | null;
  ribbon: Array<{ week_start: string; rides: number; distance_m: number }>;
  regions: Array<{
    key: string;
    iso_a2: string;
    name: string | null;
    rides: number;
    distance_m: number;
    bounds: number[] | null;
    routes: string[];
  }>;
  cost_per_km: SeasonCostPerKm[];
  groups: {
    territory: SeasonTerritory;
    road_character: SeasonRoadCharacter;
    rhythm: SeasonRhythm;
    best_rides: SeasonBestRides;
    bikes: { items: SeasonBike[] };
    countries: { items: SeasonCountry[] };
  };
}

/** `rider_ride_overview`: already in the RideOverview GraphQL names. */
export interface OverviewRow {
  lastRide: {
    id: string;
    distanceM: number;
    durationS: number;
    maxSpeedMps: number | null;
    date: string;
    motorcycleName: string | null;
    summaryTitle: string | null;
  } | null;
  last7Days: PeriodRow;
  last30Days: PeriodRow;
  thisWeek: PeriodRow;
  thisMonth: PeriodRow;
  dailyDistances: Array<{ date: string; distanceM: number }>;
  currentStreak: number;
  personalRecords: Array<{
    recordType: string;
    value: number;
    unit: string;
    achievedAt: string;
    previousValue: number | null;
    rideId: string | null;
  }>;
}

interface PeriodRow {
  rideCount: number;
  distanceM: number;
  durationS: number;
}
