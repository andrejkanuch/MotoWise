/**
 * Ride-map orientation preference.
 *
 * - `north`   — fixed north-up (map does not rotate).
 * - `heading` — course-up: the map rotates so the direction of travel points up.
 *
 * Persisted per-user in the `auth-preferences` store; consumed by the ride HUD
 * map (`components/ride/hud-map.tsx`) and the settings segmented control
 * (`components/profile/preferences-section.tsx`).
 */
export const MAP_ORIENTATIONS = {
  NORTH: 'north',
  HEADING: 'heading',
} as const;

export type MapOrientation = (typeof MAP_ORIENTATIONS)[keyof typeof MAP_ORIENTATIONS];
