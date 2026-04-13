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

// ---- Types ----

export interface Place {
  id: string;
  kind: 'country' | 'region' | 'city';
  name: string;
  countryCode: string;
  regionCode: string | null;
  slug: string;
  parentId: string | null;
  routeCount: number;
}

export interface RouteListItem {
  id: string;
  name: string | null;
  displayName: string | null;
  distanceM: number;
  elevationGainM: number | null;
  surfaceType: string | null;
  curvatureIndex: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  slug: string | null;
  countryCode: string | null;
  regionSlug: string | null;
}

// ---- Queries ----

/** Fetch all countries that have at least 1 route. */
export async function fetchCountries(): Promise<Place[]> {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, slug, parent_id, route_count')
    .eq('kind', 'country')
    .gt('route_count', 0)
    .order('name', { ascending: true });

  if (error) throw new Error(`fetchCountries: ${error.message}`);
  return (data ?? []).map(mapPlaceRow);
}

/** Fetch a country by its slug. */
export async function fetchCountryBySlug(slug: string): Promise<Place | null> {
  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, slug, parent_id, route_count')
    .eq('kind', 'country')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return mapPlaceRow(data);
}

/** Fetch regions for a given country slug. */
export async function fetchRegionsByCountrySlug(countrySlug: string): Promise<Place[]> {
  // First get the country
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return [];

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from('places')
    .select('id, kind, name, country_code, region_code, slug, parent_id, route_count')
    .eq('kind', 'region')
    .eq('country_code', country.countryCode)
    .gt('route_count', 0)
    .order('route_count', { ascending: false });

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
    .select('id, kind, name, country_code, region_code, slug, parent_id, route_count')
    .eq('kind', 'region')
    .eq('country_code', country.countryCode)
    .eq('slug', regionSlug)
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
      'id, name, display_name, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, slug, country_code, region_slug',
    )
    .eq('status', 'published')
    .eq('country_code', countryCode)
    .eq('region_slug', regionSlug)
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
      'id, name, display_name, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, slug, country_code, region_slug',
    )
    .eq('status', 'published')
    .eq('country_code', countryCode)
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(`fetchRoutesByCountry: ${error.message}`);
  return (data ?? []).map(mapRouteRow);
}

// ---- Mappers (snake_case → camelCase) ----

interface PlaceRow {
  id: string;
  kind: string;
  name: string;
  country_code: string;
  region_code: string | null;
  slug: string;
  parent_id: string | null;
  route_count: number;
}

function mapPlaceRow(row: PlaceRow): Place {
  return {
    id: row.id,
    kind: row.kind as Place['kind'],
    name: row.name,
    countryCode: row.country_code,
    regionCode: row.region_code,
    slug: row.slug,
    parentId: row.parent_id,
    routeCount: row.route_count,
  };
}

interface RouteRow {
  id: string;
  name: string | null;
  display_name: string | null;
  distance_m: number;
  elevation_gain_m: number | null;
  surface_type: string | null;
  curvature_index: number | null;
  rating_avg: number | null;
  rating_count: number;
  slug: string | null;
  country_code: string | null;
  region_slug: string | null;
}

function mapRouteRow(row: RouteRow): RouteListItem {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    distanceM: row.distance_m,
    elevationGainM: row.elevation_gain_m,
    surfaceType: row.surface_type,
    curvatureIndex: row.curvature_index,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    slug: row.slug,
    countryCode: row.country_code,
    regionSlug: row.region_slug,
  };
}
