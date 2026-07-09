/**
 * English display name for an ISO 3166-1 alpha-2 country code, via ICU.
 *
 * Single shared implementation for the ICU quirks both apps must handle the
 * same way (api PlacesService + web geo-names previously duplicated this):
 * - `Intl.DisplayNames.of()` throws a RangeError for non-well-formed subtags,
 *   so input is shape-guarded first.
 * - ICU echoes the input back for syntactically valid but unassigned codes.
 * - ZZ-style placeholder codes map to the CLDR "Unknown Region" sentinel.
 * All three mean "not a real country" and resolve to `null`.
 */

const COUNTRY_DISPLAY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** CLDR sentinel returned for placeholder codes like ZZ. */
const ICU_UNKNOWN_REGION = 'Unknown Region';

const ALPHA2_RE = /^[A-Z]{2}$/;

/** Resolve a country code (any case) to an English name, or null when it is not a real country. */
export function countryNameFromCode(code: string): string | null {
  const upper = code.trim().toUpperCase();
  if (!ALPHA2_RE.test(upper)) return null;
  const name = COUNTRY_DISPLAY_NAMES.of(upper);
  if (!name || name === upper || name === ICU_UNKNOWN_REGION) return null;
  return name;
}
