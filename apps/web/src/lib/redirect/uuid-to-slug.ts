import { RoutePathByIdDocument } from '@motovault/graphql';
import { gqlServerFetcher } from '@/lib/graphql-server';

// Simple in-memory LRU cache (works for single Vercel instance)
const cache = new Map<string, { country: string; region: string; slug: string }>();
const MAX_CACHE = 10000;

export async function resolveUuidToSlug(
  uuid: string,
): Promise<{ country: string; region: string; slug: string } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return null;
  }

  const cached = cache.get(uuid);
  if (cached) return cached;

  let path: { countryCode: string; regionCode: string; slug: string } | null | undefined;
  try {
    const data = await gqlServerFetcher(RoutePathByIdDocument, { routeId: uuid });
    path = data.routePathById;
  } catch {
    return null;
  }

  if (!path?.slug || !path.countryCode || !path.regionCode) return null;

  const result = {
    country: path.countryCode.toLowerCase(),
    region: path.regionCode.toLowerCase(),
    slug: path.slug.toLowerCase(),
  };

  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(uuid, result);

  return result;
}
