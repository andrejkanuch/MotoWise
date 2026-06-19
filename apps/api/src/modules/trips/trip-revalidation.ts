import { CACHE_TAGS } from '@motovault/types';

/** Web route prefixes for ISR-cached, DB-sourced pages (mirror of web routes). */
const WEB_PATHS = {
  explore: '/explore',
  trips: '/trips',
} as const;

/**
 * Tags + (locale-agnostic) paths to revalidate when a trip template is
 * published or unpublished. The web `/api/revalidate` endpoint fans each path
 * out to its locale variants, so only the bare paths are listed here.
 *
 * Only `CACHE_TAGS.places` is sent — it backs the cached country list
 * (`fetchCountries`). Trip / region / detail freshness rides on `paths`, so no
 * `trips` tag is sent (no web read is tagged with it; a tag with no subscriber
 * would be a silent no-op).
 */
export function tripTemplateRevalidation(
  countryCode?: string | null,
  regionCode?: string | null,
  slug?: string | null,
): { tags: string[]; paths: string[] } {
  const cc = countryCode?.toLowerCase();
  const rc = regionCode?.toLowerCase();
  const paths: string[] = [WEB_PATHS.explore];
  // Country-level: explore hub + the /trips/<cc> listing (revalidate=300).
  if (cc) paths.push(`${WEB_PATHS.explore}/${cc}`, `${WEB_PATHS.trips}/${cc}`);
  if (cc && rc) paths.push(`${WEB_PATHS.explore}/${cc}/${rc}`);
  if (cc && rc && slug) paths.push(`${WEB_PATHS.trips}/${cc}/${rc}/${slug.toLowerCase()}`);
  return { tags: [CACHE_TAGS.places], paths };
}
