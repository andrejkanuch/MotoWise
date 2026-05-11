/**
 * Normalised slug parameters for trip/route lookups.
 *
 * URLs use lowercase (`/trips/jp/kanto/tokyo-ride`), but the DB stores
 * region_code in mixed case (`IT-BZ`, `ca`, `JP-13`).
 *
 * `countryCode` is always UPPER (ISO 3166-1 alpha-2).
 * `regionCode`  is always lower  (used via case-insensitive filter).
 * `slug`        is always lower  (slugs are always lowercase).
 */
export interface SlugParams {
  countryCode: string;
  regionCode: string;
  slug: string;
}

/** Normalise raw URL params into consistent slug lookup values. */
export function normalizeSlugParams(country: string, region: string, slug: string): SlugParams {
  return {
    countryCode: country.toUpperCase(),
    regionCode: region.toLowerCase(),
    slug: slug.toLowerCase(),
  };
}

/**
 * Apply the standard country + region + slug filters to a Supabase query.
 *
 * Uses `.eq()` for country_code (uppercased) and slug, and `.ilike()` for
 * region_code to handle mixed-case DB values until data is normalised.
 *
 * Usage:
 * ```ts
 * const query = supabase.from('trips').select('*');
 * const filtered = applySlugFilters(query, country, region, slug);
 * const { data } = await filtered.single();
 * ```
 */
interface SlugFilterable {
  eq(column: string, value: string): this;
  ilike(column: string, pattern: string): this;
}

export function applySlugFilters<T extends SlugFilterable>(
  query: T,
  country: string,
  region: string,
  slug: string,
): T {
  const params = normalizeSlugParams(country, region, slug);
  return query
    .eq('country_code', params.countryCode)
    .ilike('region_code', params.regionCode)
    .eq('slug', params.slug);
}
