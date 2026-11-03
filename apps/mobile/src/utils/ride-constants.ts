import type { TFunction } from 'i18next';

/** i18n key of each ride record type's label — shared between ride-card and ride-summary. */
export const RECORD_LABEL_KEY = {
  longest_distance: 'rideSummary.record.longestDistance',
  longest_duration: 'rideSummary.record.longestDuration',
  top_speed: 'rideSummary.record.topSpeed',
  max_elevation_gain: 'rideSummary.record.maxElevationGain',
} as const;

/** A personal-record type's label in the app language; a type this build does not know shows `fallback`. */
export function recordLabel(
  t: TFunction,
  recordType: string,
  fallback: string = recordType,
): string {
  return Object.hasOwn(RECORD_LABEL_KEY, recordType)
    ? t(RECORD_LABEL_KEY[recordType as keyof typeof RECORD_LABEL_KEY])
    : fallback;
}

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

/** " · +12% on previous best" after the PB distance, or nothing when it is not an improvement. */
export function pbDeltaSuffix(t: TFunction, pbDelta: number | null | undefined): string {
  return pbDelta != null && pbDelta > 0 ? t('rideSummary.pbDelta', { pct: pbDelta }) : '';
}

/** The ride share-sheet text, e.g. "Just completed a 151 km ride in 3h 9m with MotoVault!". */
export function rideShareMessage(t: TFunction, distance: string, duration: string): string {
  return t('rideSummary.shareMessage', { distance, duration });
}
