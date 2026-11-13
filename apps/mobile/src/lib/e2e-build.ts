/**
 * Build-time switches baked into E2E builds by their EAS profile (`eas.json` `e2e-*`).
 * Store builds never set them, so every value here is `false` there.
 */

/** The only value an E2E profile sets a switch to; anything else (unset included) is off. */
const E2E_SWITCH_ON = '1';

/**
 * `EXPO_PUBLIC_E2E_NO_VENDOR_SDKS=1`: the build must not send anything to RevenueCat,
 * PostHog or Meta, so test runs never show up in those dashboards (owner rule, 2026-11-03).
 * EAS rejects empty strings in `eas.json` env, so the keys cannot simply be blanked there.
 */
export function vendorSdksDisabled(value = process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS): boolean {
  return value === E2E_SWITCH_ON;
}

/**
 * `EXPO_PUBLIC_E2E_RUN=1`: set by every E2E profile. Analytics tags that build's events
 * with `e2e_run: true` (lib/analytics-release-marker.ts) so metrics can exclude them.
 */
export function isE2eRun(value = process.env.EXPO_PUBLIC_E2E_RUN): boolean {
  return value === E2E_SWITCH_ON;
}
