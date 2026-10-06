/** Labels for ride record types — shared between ride-card and ride-summary */
export const RECORD_LABELS: Record<string, string> = {
  longest_distance: 'Longest ride',
  longest_duration: 'Longest duration',
  top_speed: 'Top speed',
  max_elevation_gain: 'Most elevation',
};

/** Ride floors: under either one, a ride is most likely a mis-tap or a test tap.
 *  The HUD asks for confirmation before ending below them; analytics tags such
 *  rides `below_min_ride` so insights can filter them out. */
export const MIN_RIDE_ELAPSED_S = 30;
export const MIN_RIDE_DISTANCE_M = 50;
