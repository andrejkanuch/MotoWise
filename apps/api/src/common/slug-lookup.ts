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

interface SlugFilterable {
  eq(column: string, value: string): this;
  ilike(column: string, pattern: string): this;
}

/**
 * Case-insensitive equality filter for mixed-case columns (e.g. region_code
 * stores both 'ca' and 'JP-03').
 *
 * `.ilike()` without wildcards is case-insensitive equality — but PostgREST
 * treats `%`, `_`, and `\` in the value as LIKE metacharacters, so raw user
 * input (URL segments, GraphQL filters) must be escaped or `/explore/jp/jp_13`
 * would pattern-match 'JP-13' and mint duplicate-content pages.
 */
export function ilikeEquals<T extends SlugFilterable>(query: T, column: string, value: string): T {
  return query.ilike(column, value.toLowerCase().replace(/[\\%_]/g, '\\$&'));
}

/**
 * Apply the standard country + region + slug filters to a Supabase query.
 *
 * Uses `.eq()` for country_code (uppercased) and slug, and case-insensitive
 * equality for region_code to handle mixed-case DB values until data is
 * normalised.
 *
 * Usage:
 * ```ts
 * const query = supabase.from('trips').select('*');
 * const filtered = applySlugFilters(query, country, region, slug);
 * const { data } = await filtered.single();
 * ```
 */
export function applySlugFilters<T extends SlugFilterable>(
  query: T,
  country: string,
  region: string,
  slug: string,
): T {
  const params = normalizeSlugParams(country, region, slug);
  return ilikeEquals(
    query.eq('country_code', params.countryCode).eq('slug', params.slug),
    'region_code',
    params.regionCode,
  );
}
