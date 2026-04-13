import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = url && key ? createClient(url, key) : null;

// Simple in-memory LRU cache (works for single Vercel instance)
const cache = new Map<string, { country: string; region: string; slug: string }>();
const MAX_CACHE = 10000;

export async function resolveUuidToSlug(
  uuid: string,
): Promise<{ country: string; region: string; slug: string } | null> {
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return null;
  }

  if (!supabase) return null;

  const cached = cache.get(uuid);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('routes')
    .select('slug, country_code, region_code')
    .eq('id', uuid)
    .single();

  if (error || !data?.slug) return null;

  const result = {
    country: data.country_code,
    region: data.region_code,
    slug: data.slug,
  };

  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(uuid, result);

  return result;
}
