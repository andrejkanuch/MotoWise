/**
 * Row shapes of the derived ride tables at the query boundary. `database.types.ts`
 * is generated from production and lags it, so the service-role client is
 * untyped here and these interfaces are the contract.
 */
import type { BandKm } from './compute/bends';
import type { LeanBands } from './compute/lean';
import type { RideStop } from './compute/stops';

export const RIDE_STATS_TABLE = 'ride_stats';
export const RIDE_TRACKS_TABLE = 'ride_tracks';

export const INPUT_SOURCE = {
  WAYPOINTS: 'waypoints',
  POLYLINE: 'polyline',
  NONE: 'none',
} as const;
export type InputSource = (typeof INPUT_SOURCE)[keyof typeof INPUT_SOURCE];

/** The `rides` columns the compute reads. */
export interface RideForStats {
  id: string;
  user_id: string;
  motorcycle_id: string | null;
  status: string;
  deleted_at: string | null;
  started_at: string;
  ended_at: string | null;
  distance_m: number | null;
  route_polyline: string | null;
  time_zone: string | null;
}

/**
 * A `ride_stats` row as the compute writes it. The weather columns
 * (weather, weather_fetched_at, temp_min_c, temp_max_c, wet) belong to the
 * separate weather step and are never part of this upsert, so a recompute
 * cannot wipe them.
 */
export interface RideStatsWrite {
  ride_id: string;
  user_id: string;
  motorcycle_id: string | null;
  stats_version: number;
  input_source: InputSource;
  wp_count: number;
  wp_truncated: boolean;
  time_zone: string;
  local_date: string;
  local_start_hour: number;
  local_dow: number;
  distance_m: number;
  elapsed_s: number;
  moving_time_s: number | null;
  avg_moving_speed_mps: number | null;
  max_speed_mps: number | null;
  climb_m: number | null;
  descent_m: number | null;
  max_altitude_m: number | null;
  min_altitude_m: number | null;
  bends_count: number | null;
  bends_per_km: number | null;
  band_km: BandKm | null;
  lean_bands: LeanBands | null;
  night_m: number | null;
  stop_count: number | null;
  stops: RideStop[] | null;
  countries: string[] | null;
  start_region: string | null;
  start_place: string | null;
  end_place: string | null;
  /** int8 as a decimal string: H3 indexes exceed Number.MAX_SAFE_INTEGER. */
  start_cell: string | null;
  cells: string[] | null;
  gps_quality: number | null;
  gps_metrics: Record<string, number> | null;
}

/** A `ride_tracks` row as written; `route` is EWKT for `geometry(LineString, 4326)`. */
export interface RideTrackWrite {
  ride_id: string;
  user_id: string;
  source: Exclude<InputSource, 'none'>;
  route: string;
  stats_version: number;
}

/** The weather step's columns of `ride_stats`. */
export interface RideStatsWeatherWrite {
  weather: unknown;
  weather_fetched_at: string;
  temp_min_c: number;
  temp_max_c: number;
  wet: boolean;
}
