import { regionDisplayName } from '@/lib/geo-names';

/**
 * The API's stand-in when an organiser has no display name
 * (apps/api trip-lifecycle.service.ts). It is not a name, so pages omit the credit.
 */
const ORGANISER_FALLBACK_NAME = 'Rider';

const normaliseCode = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

/**
 * A region's human name, or null when the name map has none. regionDisplayName
 * falls back to the title-cased code ("CL NB"), which reads as a placeholder;
 * ISO-style codes ("US-CA") are retried without their country prefix.
 */
export function humanRegionName(
  countryCode: string,
  regionCode: string | null | undefined,
): string | null {
  if (!regionCode) return null;
  const prefix = `${countryCode.toUpperCase()}-`;
  const candidates = regionCode.toUpperCase().startsWith(prefix)
    ? [regionCode, regionCode.slice(prefix.length)]
    : [regionCode];
  for (const code of candidates) {
    const name = regionDisplayName(countryCode, code);
    if (normaliseCode(name) !== normaliseCode(code)) return name;
  }
  return null;
}

/** The organiser's real display name, or null when the API sent its placeholder. */
export function curatorName(displayName: string | null | undefined): string | null {
  return displayName && displayName !== ORGANISER_FALLBACK_NAME ? displayName : null;
}
