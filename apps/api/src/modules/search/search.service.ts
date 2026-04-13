import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

/** Row shape returned by the search_routes RPC */
interface SearchRouteRow {
  id: string;
  name: string | null;
  slug: string;
  country_code: string | null;
  region_code: string | null;
  surface_type: string | null;
  distance_m: number;
  elevation_gain_m: number | null;
  rating_avg: number | null;
  rating_count: number;
  text_rank: number;
  geo_rank: number;
}

/** Row shape returned by the typeahead_routes RPC */
interface TypeaheadRouteRow {
  id: string;
  name: string;
  slug: string;
  country_code: string | null;
  region_code: string | null;
}

/** Row shape returned by the typeahead_places RPC */
interface TypeaheadPlaceRow {
  place_id: string;
  name: string;
  country_code: string;
  region_code: string | null;
}

export interface SearchRouteResult {
  id: string;
  name: string | null;
  slug: string;
  countryCode: string | null;
  regionCode: string | null;
  surfaceType: string | null;
  distanceM: number;
  elevationGainM: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  score: number;
}

export interface SearchRoutesOptions {
  q?: string;
  surfaceTypes?: string[];
  countryCode?: string;
  nearLat?: number;
  nearLng?: number;
  first?: number;
  after?: string;
}

export interface TypeaheadResult {
  routes: Array<{
    id: string;
    name: string;
    slug: string;
    countryCode: string | null;
    regionCode: string | null;
  }>;
  places: Array<{
    placeId: string;
    name: string;
    countryCode: string;
    regionCode: string | null;
  }>;
}

const TEXT_RANK_WEIGHT = 0.6;
const GEO_RANK_WEIGHT = 0.4;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  async searchRoutes(opts: SearchRoutesOptions): Promise<{
    results: SearchRouteResult[];
    hasNextPage: boolean;
    endCursor?: string;
  }> {
    const limit = Math.min(opts.first ?? 20, 50);

    const { data, error } = await this.supabase.rpc('search_routes', {
      search_query: opts.q ?? '',
      filter_surface_types: opts.surfaceTypes ?? null,
      filter_country_code: opts.countryCode ?? null,
      near_lat: opts.nearLat ?? null,
      near_lng: opts.nearLng ?? null,
      page_limit: limit + 1,
      page_cursor: opts.after ?? null,
    });

    if (error) {
      this.logger.error(`searchRoutes RPC failed: ${error.message}`);
      throw new Error('Search failed');
    }

    const rows = (data ?? []) as SearchRouteRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const results: SearchRouteResult[] = sliced.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      countryCode: row.country_code,
      regionCode: row.region_code,
      surfaceType: row.surface_type,
      distanceM: row.distance_m,
      elevationGainM: row.elevation_gain_m,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
      score: row.text_rank * TEXT_RANK_WEIGHT + row.geo_rank * GEO_RANK_WEIGHT,
    }));

    const lastResult = results[results.length - 1];
    return {
      results,
      hasNextPage,
      endCursor: lastResult?.id,
    };
  }

  async typeahead(q: string): Promise<TypeaheadResult> {
    if (!q || q.trim().length === 0) {
      return { routes: [], places: [] };
    }

    const [routesRes, placesRes] = await Promise.all([
      this.supabase.rpc('typeahead_routes', { query: q.trim() }),
      this.supabase.rpc('typeahead_places', { query: q.trim() }),
    ]);

    if (routesRes.error) {
      this.logger.error(`typeahead_routes RPC failed: ${routesRes.error.message}`);
    }
    if (placesRes.error) {
      this.logger.error(`typeahead_places RPC failed: ${placesRes.error.message}`);
    }

    const routeRows = (routesRes.data ?? []) as TypeaheadRouteRow[];
    const placeRows = (placesRes.data ?? []) as TypeaheadPlaceRow[];

    return {
      routes: routeRows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        countryCode: r.country_code,
        regionCode: r.region_code,
      })),
      places: placeRows.map((p) => ({
        placeId: p.place_id,
        name: p.name,
        countryCode: p.country_code,
        regionCode: p.region_code,
      })),
    };
  }
}
