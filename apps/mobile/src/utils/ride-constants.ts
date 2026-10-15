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

/** Route points requested per screen — the detail map and the flyover camera
 *  ask for different resolutions, and each is cached under its own count. */
export const RIDE_DETAIL_WAYPOINT_POINTS = 300;
export const RIDE_FLYOVER_WAYPOINT_POINTS = 400;

/** The heatmap pages every ride the rider owns: this many per page, and at most
 *  this many pages so a rider with 10k rides does not pound the API on mount.
 *  20 x 50 covers the most recent ~1000 rides; beyond that a footer hint shows. */
export const HEATMAP_PAGE_SIZE = 50;
export const HEATMAP_MAX_PAGES = 20;
