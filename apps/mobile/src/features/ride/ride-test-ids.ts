/**
 * testIDs on the ride path (issue 365 T05c, plan §3A.4). Maestro flows address the ride
 * FAB, Start Ride, the HUD and the minimum-ride guard sheet by these ids
 * (`.maestro/flows/log-ride.yaml`), so a rename here breaks those flows.
 */
export const RIDE_TEST_ID = {
  TAB_RIDE_FAB: 'tab-ride-fab',
  START_RIDE_SCREEN: 'start-ride-screen',
  START_RIDE_BUTTON: 'start-ride-button',
  HUD_ROOT: 'ride-hud-root',
  GUARD_SHEET: 'ride-guard-sheet',
  GUARD_KEEP: 'ride-guard-keep',
  GUARD_END_ANYWAY: 'ride-guard-end-anyway',
} as const;

const GUARD_VARIANT_TEST_ID_PREFIX = 'ride-guard-variant-';

/** `ride-guard-variant-<variant>`: which copy the guard sheet shows. */
export function rideGuardVariantTestId(variant: string): string {
  return `${GUARD_VARIANT_TEST_ID_PREFIX}${variant}`;
}
