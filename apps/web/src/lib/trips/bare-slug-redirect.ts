/**
 * Bare-slug → canonical-slug recovery for trip detail pages.
 *
 * Most trip slugs are clean (`dalton-highway-...`), but ~28 carry an 8-hex
 * dedup-hash suffix appended at seed time (`zionmount-carmel-highway-a90b4890`).
 * Old indexed links, hand-typed URLs, or pre-hash sitemaps may hit the *bare*
 * slug (`/trips/us/ut/zionmount-carmel-highway`), which has no row and hard-404s.
 *
 * Rather than serving the same trip at two URLs (duplicate content), the page
 * 301-redirects a bare slug to its canonical hashed slug — but only when the
 * match is unambiguous. If two trips share the same base slug (the very reason
 * the hash exists), the bare URL is genuinely ambiguous and must stay a 404.
 */

/** Minimal shape needed to resolve a redirect — decoupled from GraphQL types. */
export interface TripSlugRef {
  countryCode: string;
  regionCode: string | null;
  slug: string | null;
}

/** The dedup suffix is exactly 8 hex chars: `-a90b4890`. */
const DEDUP_HASH_RE = /^[0-9a-f]{8}$/;

/**
 * Legacy `/route/`-era slugs whose trip was later renamed (not just hash-suffixed),
 * so the dedup-hash rule can't recover them. Old indexed URLs still 301 through
 * `/route/... → /trips/...` and would 404 here (Sentry MOTOVAULT-WEB-Q).
 * Key: `{country}/{region}/{slug}` (lowercase) → canonical trips slug.
 */
const LEGACY_TRIP_SLUG_ALIASES: Record<string, string> = {
  'us/ca/pacific-coast-highway': 'pacific-coast-highway-big-sur',
};

/**
 * The `{country}/{region}/{slug}` keys above, as route params.
 *
 * Load-bearing for `generateStaticParams` under `dynamicParams = false`: an alias
 * slug has no trip row, so it is absent from the published-trip list. Without it in
 * the static params the router 404s before the page runs, and the 301 below never
 * fires — turning a redirect that preserves link equity back into the dead end
 * PR #177 fixed.
 */
export function legacyAliasParams(): { country: string; region: string; slug: string }[] {
  return Object.keys(LEGACY_TRIP_SLUG_ALIASES).map((key) => {
    const [country, region, slug] = key.split('/');
    return { country, region, slug };
  });
}

/**
 * The bare (hash-stripped) form of a slug, or null when it carries no dedup hash.
 *
 * Same reason as `legacyAliasParams`: a bare slug has no row of its own, so it must
 * be prerendered for `findBareSlugRedirect` to get the chance to 301 it.
 */
export function bareSlugOf(slug: string): string | null {
  const idx = slug.lastIndexOf('-');
  if (idx <= 0) return null;
  return DEDUP_HASH_RE.test(slug.slice(idx + 1)) ? slug.slice(0, idx) : null;
}

/** Canonical slug for a known legacy alias, or null. */
export function findLegacySlugAlias(country: string, region: string, slug: string): string | null {
  return (
    LEGACY_TRIP_SLUG_ALIASES[
      `${country.toLowerCase()}/${region.toLowerCase()}/${slug.toLowerCase()}`
    ] ?? null
  );
}

/**
 * Resolve a requested (bare) slug to its canonical slug within a country+region.
 *
 * Returns the canonical slug to redirect to, or `null` when there is no
 * unambiguous dedup-hash match (caller should 404). Never returns the requested
 * slug itself — the caller only invokes this after an exact lookup already missed.
 */
export function findBareSlugRedirect(
  trips: TripSlugRef[],
  country: string,
  region: string,
  requestedSlug: string,
): string | null {
  const bare = requestedSlug.toLowerCase();
  const cc = country.toLowerCase();
  const rc = region.toLowerCase();

  const matches = trips.filter((t) => {
    if (t.slug == null || t.regionCode == null) return false;
    if (t.countryCode.toLowerCase() !== cc) return false;
    if (t.regionCode.toLowerCase() !== rc) return false;
    const slug = t.slug.toLowerCase();
    if (!slug.startsWith(`${bare}-`)) return false;
    // Only the bare slug + dedup hash — never a genuinely different longer slug
    // (e.g. `scenic-byway-12` must not redirect to `scenic-byway-12-extended`).
    return DEDUP_HASH_RE.test(slug.slice(bare.length + 1));
  });

  if (matches.length === 1) return (matches[0].slug as string).toLowerCase();
  return null;
}
