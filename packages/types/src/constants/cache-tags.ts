/**
 * Cache tags for DB-sourced web content, shared by the web app (attaches them
 * to `unstable_cache` reads) and the API (sends them to `POST /api/revalidate`
 * so a mutation can invalidate the matching reads on-demand). Single source of
 * truth — both sides import from here so the strings can't drift.
 */
export const CACHE_TAGS = {
  /** Browse taxonomy (countries/regions) from the `places` table. */
  places: 'places',
  /** Published trip templates (powers /trips and /explore). */
  trips: 'trips',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
