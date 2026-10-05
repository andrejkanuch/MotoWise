/** Cookie the proxy sets so client code knows which consent regime applies. */
export const REGION_COOKIE = 'mv_region';

export const CONSENT_REGION = {
  EU: 'EU',
  OTHER: 'OTHER',
} as const;
export type ConsentRegion = (typeof CONSENT_REGION)[keyof typeof CONSENT_REGION];

// EU/EEA (incl. outermost regions with their own ISO codes) + UK + CH —
// visitors from these countries require GDPR consent before analytics tracking.
// Everyone else gets auto-opted-in. Mirrors OPT_IN_REGIONS (mobile
// lib/analytics-consent.ts) and OPT_IN_COUNTRIES (api revenuecat-posthog.ts) —
// change all three together.
export const CONSENT_REQUIRED_COUNTRIES: ReadonlySet<string> = new Set([
  // EU 27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA
  'IS',
  'LI',
  'NO',
  // UK (UK GDPR) + Switzerland (FADP)
  'GB',
  'CH',
  // EU outermost regions geolocated under their own ISO codes (GDPR applies)
  'RE',
  'GP',
  'MQ',
  'GF',
  'YT',
  'MF',
  'AX',
]);
/** The consent regime for a geo country code (an unknown code counts as OTHER, as before). */
export function regionForCountry(country: string): ConsentRegion {
  return CONSENT_REQUIRED_COUNTRIES.has(country.toUpperCase())
    ? CONSENT_REGION.EU
    : CONSENT_REGION.OTHER;
}

/**
 * The `mv_region` value to (re)write, or null to leave the cookie alone.
 * - No cookie yet: always set (no geo header → OTHER, the long-standing default).
 * - Cookie set: rewrite only when a geo header is present and classifies
 *   differently, e.g. a visitor from a country newly added to the opt-in list
 *   who still holds OTHER from before. No geo header → keep the cookie.
 */
export function regionCookieUpdate(
  stored: string | undefined,
  countryHeader: string | null,
): ConsentRegion | null {
  const country = countryHeader?.trim() ?? '';
  if (stored === undefined) return regionForCountry(country);
  if (!country) return null;
  const region = regionForCountry(country);
  return region === stored ? null : region;
}
