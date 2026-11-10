import { RIDE_WAYPOINT_LIMITS } from '@motovault/types';

/** `ride_track_points(p_ride_id, p_max_points)`: a ride's whole track as one row. */
export const RIDE_TRACK_POINTS_RPC = 'ride_track_points';

/**
 * `p_max_points` for every full-track read. The API caps uploads at this many fixes,
 * but RLS lets a rider insert waypoints into their own ride directly, so an
 * unbounded read could load millions of rows into the API. Above the cap the RPC
 * returns this many evenly spaced fixes (first and last kept); `total_points`
 * still reports the true count.
 */
export const TRACK_POINTS_READ_CAP = RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE;

/** The single row `ride_track_points()` returns: parallel arrays in recorded order, oldest first. */
export interface TrackPointsRow {
  total_points: number;
  recorded_at: string[];
  latitude: number[];
  longitude: number[];
  altitude: Array<number | null>;
  speed_mps: Array<number | null>;
  heading: Array<number | null>;
  accuracy: Array<number | null>;
}
