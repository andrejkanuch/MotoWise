/** `ride_track_points(p_ride_id, p_max_points)`: a ride's whole track as one row. */
export const RIDE_TRACK_POINTS_RPC = 'ride_track_points';

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
