import type { BrowsePlace, BrowsePlaceDbRow, RouteListDbRow, RouteListItem } from '@motovault/types';
import { createClient } from '@supabase/supabase-js';

/**
 * Lightweight Supabase client for public, server-side data fetching.
 * Uses the anon key — RLS policies on `places` and `routes` allow
 * `FOR SELECT USING (true)` and `FOR SELECT USING (status = 'published')`
 * respectively, so no auth is required.
 */
function getPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}

/** Alias for `BrowsePlace` — shared type lives in `@motovault/types`. */
export type Place = BrowsePlace;
export type { RouteListItem };

// ---- Queries ----

/** Fetch all countries that have at least 1 route. */
export async function fetchCountries(): Promise<Place[]> {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, latitude, longitude, population')
    .eq('kind', 'country')
    .order('name', { ascending: true });

  if (error) throw new Error(`fetchCountries: ${error.message}`);
  return (data ?? []).map(mapPlaceRow);
}

/** ISO country code → display name fallback (when places table is empty / not seeded). */
const COUNTRY_FALLBACK: Record<string, string> = {
  US: 'United States', DE: 'Germany', AT: 'Austria', CH: 'Switzerland',
  IT: 'Italy', ES: 'Spain', FR: 'France', GB: 'United Kingdom',
  PT: 'Portugal', GR: 'Greece', HR: 'Croatia', NO: 'Norway',
  SE: 'Sweden', RO: 'Romania', CZ: 'Czech Republic',
};

/** Fetch a country by its slug (lowercase country code, e.g. "it"). */
export async function fetchCountryBySlug(slug: string): Promise<Place | null> {
  const code = slug.toUpperCase();
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, latitude, longitude, population')
    .eq('kind', 'country')
    .eq('country_code', code)
    .single();

  if (!error && data) return mapPlaceRow(data);

  // Fallback: places table may not be seeded — use hardcoded name
  const name = COUNTRY_FALLBACK[code];
  if (!name) return null;
  return {
    id: code,
    kind: 'country',
    name,
    countryCode: code,
    regionCode: null,
    slug: slug,
    parentId: null,
    routeCount: 0,
  };
}

/** Fetch regions for a given country slug. */
export async function fetchRegionsByCountrySlug(countrySlug: string): Promise<Place[]> {
  // First get the country
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return [];

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, latitude, longitude, population')
    .eq('kind', 'region')
    .eq('country_code', country.countryCode)
    .gt('population', 0)
    .order('population', { ascending: false });

  if (error) throw new Error(`fetchRegionsByCountrySlug: ${error.message}`);
  return (data ?? []).map(mapPlaceRow);
}

/** Fetch a region by country slug + region slug. */
export async function fetchRegionBySlug(
  countrySlug: string,
  regionSlug: string,
): Promise<{ country: Place; region: Place } | null> {
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return null;

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, latitude, longitude, population')
    .eq('kind', 'region')
    .eq('country_code', country.countryCode)
    .eq('region_code', regionSlug)
    .single();

  if (error) return null;
  return { country, region: mapPlaceRow(data) };
}

/** Fetch published routes for a country+region, sorted by rating. */
export async function fetchRoutesByRegion(
  countryCode: string,
  regionSlug: string,
  limit = 50,
): Promise<RouteListItem[]> {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('routes')
    .select(
      'id, name, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, slug, country_code, region_code',
    )
    .eq('status', 'published')
    .eq('country_code', countryCode.toLowerCase())
    .eq('region_code', regionSlug.toLowerCase())
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`fetchRoutesByRegion: ${error.message}`);
  return (data ?? []).map(mapRouteRow);
}

/** Fetch published routes for a country, sorted by rating. */
export async function fetchRoutesByCountry(
  countryCode: string,
  limit = 50,
): Promise<RouteListItem[]> {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('routes')
    .select(
      'id, name, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, slug, country_code, region_code',
    )
    .eq('status', 'published')
    .eq('country_code', countryCode.toLowerCase())
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`fetchRoutesByCountry: ${error.message}`);
  return (data ?? []).map(mapRouteRow);
}

// ---- Mappers (snake_case → camelCase) ----

function mapPlaceRow(row: BrowsePlaceDbRow): BrowsePlace {
  return {
    id: row.id,
    kind: row.kind as BrowsePlace['kind'],
    name: row.name,
    countryCode: row.country_code,
    regionCode: row.region_code,
    slug: row.slug ?? row.country_code.toLowerCase(),
    parentId: row.parent_id ?? null,
    routeCount: row.route_count ?? 0,
  };
}

function mapRouteRow(row: RouteListDbRow): RouteListItem {
  return {
    id: row.id,
    name: row.name,
    displayName: row.name,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
    surfaceType: row.surface_type,
    curvatureIndex: row.curvature_index,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    slug: row.slug,
    countryCode: row.country_code,
    regionSlug: row.region_code,
  };
}
