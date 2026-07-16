/**
 * Geo allow-list for indexing trip/place pages.
 *
 * MotoVault targets **Europe + the Americas only** (feedback_no_india_market;
 * docs/SEO-Conversion-Plan-2026-07-15.md P4.1). Off-market trip pages — India
 * above all — pollute the search profile and convert ~nothing. Pages outside
 * this set get `robots: { index: false, follow: true }` + sitemap exclusion:
 * follow keeps internal-link equity flowing, so this is non-destructive and
 * fully reversible (add a code below and the page re-indexes on next crawl).
 *
 * ISO 3166-1 alpha-2, uppercase. Broad Europe + all of the Americas. Asia
 * (incl. India, Japan), Oceania (AU/NZ), Africa, and the Middle East are
 * intentionally excluded — add a code here when a market gets real content.
 */
export const EU_AMERICAS_COUNTRIES = new Set<string>([
  // Europe
  'AL',
  'AD',
  'AT',
  'AX',
  'BA',
  'BE',
  'BG',
  'CH',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FO',
  'FR',
  'GB',
  'GG',
  'GI',
  'GR',
  'HR',
  'HU',
  'IE',
  'IM',
  'IS',
  'IT',
  'JE',
  'LI',
  'LT',
  'LU',
  'LV',
  'MC',
  'MD',
  'ME',
  'MK',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'RS',
  'SE',
  'SI',
  'SK',
  'SM',
  'UA',
  'VA',
  'XK',
  // North + Central America + Caribbean
  'US',
  'CA',
  'MX',
  'GT',
  'BZ',
  'SV',
  'HN',
  'NI',
  'CR',
  'PA',
  'CU',
  'DO',
  'JM',
  'PR',
  'TT',
  'BS',
  'BB',
  'HT',
  'AG',
  'DM',
  'GD',
  'KN',
  'LC',
  'VC',
  // South America
  'AR',
  'BO',
  'BR',
  'CL',
  'CO',
  'EC',
  'GY',
  'PE',
  'PY',
  'SR',
  'UY',
  'VE',
  'GF',
]);

/** Whether a country (ISO alpha-2, any case) is an on-target market to index. */
export function isTargetMarket(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return EU_AMERICAS_COUNTRIES.has(countryCode.toUpperCase());
}
