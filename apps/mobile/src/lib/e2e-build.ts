/**
 * Build-time switches baked into E2E builds by their EAS profile (`eas.json` `e2e-*`).
 * Store builds never set them, so every value here is `false` there.
 */

/**
 * `EXPO_PUBLIC_E2E_NO_VENDOR_SDKS=1`: the build must not send anything to RevenueCat,
 * PostHog or Meta, so test runs never show up in those dashboards (owner rule, 2026-11-03).
 * EAS rejects empty strings in `eas.json` env, so the keys cannot simply be blanked there.
 */
export function vendorSdksDisabled(value = process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS): boolean {
  return value === '1';
}
