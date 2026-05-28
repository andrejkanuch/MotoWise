/**
 * Fetches the real App Store rating for MotoVault via the iTunes Lookup API.
 *
 * Used exclusively by the homepage to populate `AggregateRating` in the
 * `SoftwareApplication` JSON-LD. The rating must match visible text on the
 * page per Google guidelines — see schema.ts header comment.
 *
 * PPR-safe: the project has `cacheComponents: false` so async fetches in
 * server components work without Suspense boundaries. The fetch itself uses
 * Next.js `revalidate: 86400` (24h) to avoid unnecessary API calls.
 */

import type { AggregateRatingInput } from './schema';

const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup?id=6760291360&country=us';

interface iTunesResult {
  averageUserRating?: number;
  userRatingCount?: number;
}

export async function getAppStoreRating(): Promise<AggregateRatingInput | null> {
  try {
    const res = await fetch(ITUNES_LOOKUP_URL, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: iTunesResult[] };
    const app = data.results?.[0];
    if (!app?.averageUserRating || !app?.userRatingCount) return null;
    return {
      ratingValue: app.averageUserRating.toFixed(1),
      reviewCount: String(app.userRatingCount),
    };
  } catch {
    return null;
  }
}
