import { WebTripPathByIdDocument } from '@motovault/graphql';
import { gqlServerFetcher } from '@/lib/graphql-server';

// Simple in-memory LRU cache (works for single Vercel instance)
const cache = new Map<string, { country: string; region: string; slug: string }>();
const MAX_CACHE = 10000;

/**
 * Resolve a trip UUID to its canonical slug path.
 * Uses the trips table (unified model) instead of the legacy routes table.
 */
export async function resolveUuidToSlug(
  uuid: string,
): Promise<{ country: string; region: string; slug: string } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return null;
  }

  const cached = cache.get(uuid);
  if (cached) return cached;

  let trip: {
    countryCode?: string | null;
    regionCode?: string | null;
    slug?: string | null;
  } | null = null;
  try {
    const data = await gqlServerFetcher(WebTripPathByIdDocument, { tripId: uuid });
    trip = data.tripDetail;
  } catch {
    return null;
  }

  if (!trip?.slug || !trip.countryCode || !trip.regionCode) return null;

  const result = {
    country: trip.countryCode.toLowerCase(),
    region: trip.regionCode.toLowerCase(),
    slug: trip.slug.toLowerCase(),
  };

  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(uuid, result);

  return result;
}
