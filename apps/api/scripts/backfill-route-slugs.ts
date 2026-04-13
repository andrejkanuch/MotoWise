/**
 * Backfill script: populate slug, country_code, region_code, city
 * on routes that are missing them.
 *
 * Usage:
 *   npx tsx scripts/backfill-route-slugs.ts
 *   npx tsx scripts/backfill-route-slugs.ts --dry-run
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

// Untyped client — this script runs standalone without database.types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<Record<string, unknown>>;

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

interface RouteRow {
  id: string;
  name: string | null;
  lng: number;
  lat: number;
}

interface PlaceRow {
  id: string;
  name: string;
  country_code: string;
  region_code: string | null;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  let totalProcessed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  if (DRY_RUN) {
    console.log('[DRY RUN] No writes will be performed.\n');
  }

  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    // Fetch routes missing slug, extract lat/lng via ST_X / ST_Y
    const { data: routes, error: fetchError } = await supabase.rpc('get_routes_needing_slug', {
      batch_size: BATCH_SIZE,
      batch_offset: offset,
    });

    if (fetchError) {
      console.error('Failed to fetch routes:', fetchError.message);
      // Fall back to plain select if the RPC doesn't exist yet
      break;
    }

    if (!routes || routes.length === 0) {
      hasMore = false;
      break;
    }

    for (const route of routes as RouteRow[]) {
      totalProcessed++;

      try {
        // Skip routes without a name (can't generate slug)
        if (!route.name) {
          console.log(`  Skipping route ${route.id}: no name, cannot generate slug`);
          skipped++;
          continue;
        }

        // Skip routes without coordinates
        if (route.lat == null || route.lng == null) {
          console.log(`  Skipping route ${route.id}: no start_point coordinates`);
          skipped++;
          continue;
        }

        // Find nearest city in places table
        // biome-ignore lint/suspicious/noExplicitAny: script uses untyped supabase client
        const place = await findNearestPlace(supabase as unknown as UntypedClient, route.lat, route.lng);

        const countryCode = place?.country_code ?? null;
        const regionCode = place?.region_code ?? null;
        const cityName = place?.name ?? null;

        // Generate slug
        const baseSlug = slugify(route.name, {
          lower: true,
          strict: true,
        }).slice(0, 200);

        // Resolve collisions within (country_code, region_code)
        const finalSlug = await resolveSlugCollision(
          supabase as unknown as UntypedClient,
          baseSlug,
          countryCode,
          regionCode,
          route.id,
        );

        if (DRY_RUN) {
          console.log(
            `  [DRY RUN] Would update route ${route.id}: ${route.name} → ${countryCode ?? '?'}/${regionCode ?? '?'}/${finalSlug}`,
          );
        } else {
          const { error: updateError } = await supabase
            .from('routes')
            .update({
              slug: finalSlug,
              country_code: countryCode,
              region_code: regionCode,
              city: cityName,
            })
            .eq('id', route.id);

          if (updateError) {
            console.error(`  Error updating route ${route.id}:`, updateError.message);
            errors++;
            continue;
          }

          console.log(
            `  Updated route ${route.id}: ${route.name} → ${countryCode ?? '?'}/${regionCode ?? '?'}/${finalSlug}`,
          );
        }

        updated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error processing route ${route.id}: ${message}`);
        errors++;
      }
    }

    offset += routes.length;

    if (routes.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Updated:         ${updated}`);
  console.log(`Skipped:         ${skipped}`);
  console.log(`Errors:          ${errors}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes were written.');
  }
}

/**
 * Find the nearest place to the given lat/lng.
 * Tries city first, then region, then country.
 */
async function findNearestPlace(
  supabase: UntypedClient,
  lat: number,
  lng: number,
): Promise<PlaceRow | null> {
  for (const kind of ['city', 'region', 'country'] as const) {
    // @ts-expect-error — RPC params not typed without database.types.ts in standalone script
    const { data, error } = await supabase.rpc('find_nearest_place', {
      p_lat: lat,
      p_lng: lng,
      p_kind: kind,
    });

    if (error) {
      console.warn(`  Warning: find_nearest_place(${kind}) failed: ${error.message}`);
      continue;
    }

    if (data && (data as PlaceRow[]).length > 0) {
      return (data as PlaceRow[])[0];
    }
  }

  return null;
}

/**
 * If (country_code, region_code, slug) already exists,
 * append -2, -3, etc. until unique.
 */
async function resolveSlugCollision(
  supabase: UntypedClient,
  baseSlug: string,
  countryCode: string | null,
  regionCode: string | null,
  excludeRouteId: string,
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    let query = supabase
      .from('routes')
      .select('id')
      .eq('slug', candidate)
      .neq('id', excludeRouteId);

    if (countryCode != null) {
      query = query.eq('country_code', countryCode);
    } else {
      query = query.is('country_code', null);
    }

    if (regionCode != null) {
      query = query.eq('region_code', regionCode);
    } else {
      query = query.is('region_code', null);
    }

    const { data } = await query.limit(1);

    if (!data || data.length === 0) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

main().catch(console.error);
