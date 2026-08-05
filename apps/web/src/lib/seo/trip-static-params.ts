import { fetchPublishedTripSlugRefs } from '@/lib/fetch-places';
import type { TripSlugRef } from '@/lib/trips/bare-slug-redirect';

/**
 * Guarded trip-list fetch for `generateStaticParams`.
 *
 * Every route that sets `dynamicParams = false` derives the COMPLETE set of URLs it
 * will serve from this list. A short list therefore does not degrade gracefully — it
 * silently 404s real content, because a param that is absent at build time can never
 * be rendered afterwards.
 *
 * The dangerous part is that the upstream fails SOFT. `sitemapPublishedTrips` in the
 * API catches its own database error, logs a warning, and returns an empty array as a
 * *successful* GraphQL response:
 *
 *     if (error) {
 *       this.logger.warn(`sitemapPublishedTrips: ${error.message}`);
 *       return [];
 *     }
 *
 * So `fetchPublishedTripSlugRefs()` resolves normally with `[]`, nothing throws, and a
 * transient database blip during any build would publish a site whose entire trip and
 * explore sections 404 — with a green build and no error anywhere. Simply not catching
 * in the caller does NOT protect against this; there is no rejection to propagate.
 *
 * Hence an explicit floor. Anything below it is treated as a degraded upstream rather
 * than as real data, and throwing here fails the build — the recoverable direction,
 * versus shipping a site with its content silently removed.
 */

/**
 * Minimum plausible number of published trips.
 *
 * Production carries several hundred, so this is far below any legitimate value while
 * still being decisively above the failure signature (`0`, or a handful from a
 * partially-degraded response). It is a tripwire, not a target: raise it only if the
 * real floor rises, and never lower it to make a failing build pass — a failure here
 * means the data is wrong, not that the check is.
 */
export const MIN_EXPECTED_PUBLISHED_TRIPS = 50;

/**
 * Fetch the published-trip refs, refusing to proceed on an implausibly short list.
 *
 * @throws when the upstream returns fewer than {@link MIN_EXPECTED_PUBLISHED_TRIPS}
 *   entries, which fails the build instead of shipping missing content.
 */
export async function fetchTripRefsForStaticParams(): Promise<TripSlugRef[]> {
  const refs = await fetchPublishedTripSlugRefs();

  if (refs.length < MIN_EXPECTED_PUBLISHED_TRIPS) {
    throw new Error(
      `generateStaticParams: published-trip list came back with ${refs.length} entries, ` +
        `below the ${MIN_EXPECTED_PUBLISHED_TRIPS} floor. These routes use ` +
        `dynamicParams=false, so building from this list would 404 every trip and ` +
        `explore URL. Note the API returns [] on its own database error, so this is ` +
        `the only place that failure becomes visible. Failing the build instead.`,
    );
  }

  return refs;
}

/** Deduped, lowercased `{country}` params for every country with a published trip. */
export function countryParams(refs: TripSlugRef[]): { country: string }[] {
  const seen = new Set(refs.map((r) => r.countryCode.toLowerCase()));
  return [...seen].map((country) => ({ country }));
}

/** Deduped, lowercased `{country, region}` params for every published country/region. */
export function countryRegionParams(refs: TripSlugRef[]): { country: string; region: string }[] {
  const seen = new Map<string, { country: string; region: string }>();
  for (const r of refs) {
    if (!r.regionCode) continue;
    const country = r.countryCode.toLowerCase();
    const region = r.regionCode.toLowerCase();
    seen.set(`${country}/${region}`, { country, region });
  }
  return [...seen.values()];
}

/** Deduped, lowercased `{country, region, slug}` params for every published trip. */
export function tripParams(
  refs: TripSlugRef[],
): { country: string; region: string; slug: string }[] {
  const seen = new Map<string, { country: string; region: string; slug: string }>();
  for (const r of refs) {
    if (!r.slug || !r.regionCode) continue;
    const p = {
      country: r.countryCode.toLowerCase(),
      region: r.regionCode.toLowerCase(),
      slug: r.slug.toLowerCase(),
    };
    seen.set(`${p.country}/${p.region}/${p.slug}`, p);
  }
  return [...seen.values()];
}
