/**
 * Cache tags for DB-sourced content, used with `unstable_cache({ tags })` and
 * on-demand `revalidateTag` (see /api/revalidate). Tags let the API invalidate
 * cached reads the instant content changes, so pages can use long `revalidate`
 * windows instead of short ones — which is what keeps ISR/Data Cache writes low.
 */
export const CACHE_TAGS = {
  /** Browse taxonomy (countries/regions) from the `places` table. */
  places: 'places',
  /** Published trip templates (powers /trips and /explore). */
  trips: 'trips',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
