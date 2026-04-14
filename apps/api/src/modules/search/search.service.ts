import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { LatLngInput, SearchRoutesFilterInput } from './dto/search-routes.input';
import type { RouteSearchConnection } from './models/search-result.model';
import type { TypeaheadResult } from './models/typeahead-result.model';

const MAX_TYPEAHEAD_LIMIT = 20;
const MAX_QUERY_LENGTH = 100;

interface SearchRouteRow {
  id: string;
  name: string | null;
  description: string | null;
  polyline: string;
  distance_m: number;
  elevation_gain_m: number | null;
  surface_type: string | null;
  curvature_index: number | null;
  is_motovault_pick: boolean;
  editorial_description: string | null;
  rating_avg: number | null;
  rating_count: number;
  comment_count: number;
  status: string;
  created_at: string;
  contributor_user_id: string;
  start_lat: number | null;
  start_lng: number | null;
  contributor_display_name: string | null;
  contributor_username: string | null;
  contributor_avatar_url: string | null;
  rank_score: number;
}

/** Encode (score, id) cursor as base64 */
function encodeCursor(score: number, id: string): string {
  return Buffer.from(`${score}:${id}`).toString('base64');
}

/** Decode cursor back to (score, id) */
function decodeCursor(cursor: string): { score: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const separatorIdx = decoded.indexOf(':');
    if (separatorIdx === -1) return null;
    const score = Number.parseFloat(decoded.slice(0, separatorIdx));
    const id = decoded.slice(separatorIdx + 1);
    if (Number.isNaN(score) || !id) return null;
    return { score, id };
  } catch {
    return null;
  }
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async searchRoutes(
    q?: string,
    near?: LatLngInput,
    filters?: SearchRoutesFilterInput,
    first = 20,
    after?: string,
  ): Promise<RouteSearchConnection> {
    const limit = Math.min(first, 50);

    // Build dynamic SQL for FTS + geo ranking
    const params: unknown[] = [];
    let paramIdx = 0;
    const nextParam = () => {
      paramIdx++;
      return `$${paramIdx}`;
    };

    // --- SELECT columns ---
    const selectCols = [
      'r.id',
      'r.name',
      'r.description',
      'r.polyline',
      'r.distance_m',
      'r.elevation_gain_m',
      'r.surface_type',
      'r.curvature_index',
      'r.is_motovault_pick',
      'r.editorial_description',
      'r.rating_avg',
      'r.rating_count',
      'r.comment_count',
      'r.status',
      'r.created_at',
      'r.contributor_user_id',
      'ST_Y(r.start_point::geometry) AS start_lat',
      'ST_X(r.start_point::geometry) AS start_lng',
      'u.display_name AS contributor_display_name',
      'u.public_username AS contributor_username',
      'u.avatar_url AS contributor_avatar_url',
    ];

    // --- Ranking expression ---
    let rankExpr: string;

    if (q && near) {
      // Combined: text * 0.6 + geo * 0.4
      const qParam = nextParam();
      params.push(q);
      const lngParam = nextParam();
      params.push(near.lng);
      const latParam = nextParam();
      params.push(near.lat);

      rankExpr = `(ts_rank(r.search_tsv, plainto_tsquery('simple', ${qParam})) * 0.6 + (1.0 / (1.0 + ST_Distance(r.start_point, ST_MakePoint(${lngParam}, ${latParam})::geography) / 50000.0)) * 0.4)`;
    } else if (q) {
      // Text only
      const qParam = nextParam();
      params.push(q);
      rankExpr = `ts_rank(r.search_tsv, plainto_tsquery('simple', ${qParam}))`;
    } else if (near) {
      // Geo only
      const lngParam = nextParam();
      params.push(near.lng);
      const latParam = nextParam();
      params.push(near.lat);
      rankExpr = `(1.0 / (1.0 + ST_Distance(r.start_point, ST_MakePoint(${lngParam}, ${latParam})::geography) / 50000.0))`;
    } else {
      // Fallback: sort by rating
      rankExpr = 'COALESCE(r.rating_avg, 0)';
    }

    selectCols.push(`${rankExpr} AS rank_score`);

    // --- WHERE clauses ---
    const whereClauses: string[] = ["r.status = 'published'"];

    // Text filter: only rows matching the tsquery
    if (q) {
      const qParam = nextParam();
      params.push(q);
      whereClauses.push(`r.search_tsv @@ plainto_tsquery('simple', ${qParam})`);
    }

    // Distance filter
    if (filters?.minKm != null) {
      const p = nextParam();
      params.push(filters.minKm * 1000);
      whereClauses.push(`r.distance_m >= ${p}`);
    }
    if (filters?.maxKm != null) {
      const p = nextParam();
      params.push(filters.maxKm * 1000);
      whereClauses.push(`r.distance_m <= ${p}`);
    }

    // Surface types
    if (filters?.surfaceTypes && filters.surfaceTypes.length > 0) {
      const p = nextParam();
      params.push(filters.surfaceTypes);
      whereClauses.push(`r.surface_type = ANY(${p})`);
    }

    // Country / region codes
    if (filters?.countryCode) {
      const p = nextParam();
      params.push(filters.countryCode);
      whereClauses.push(`r.country_code = ${p}`);
    }
    if (filters?.regionCode) {
      const p = nextParam();
      params.push(filters.regionCode);
      whereClauses.push(`r.region_code = ${p}`);
    }

    // Cursor-based pagination (keyset on score, id)
    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        const scoreParam = nextParam();
        params.push(cursor.score);
        const idParam = nextParam();
        params.push(cursor.id);
        whereClauses.push(
          `(${rankExpr} < ${scoreParam} OR (${rankExpr} = ${scoreParam} AND r.id > ${idParam}))`,
        );
      }
    }

    // --- Build final SQL ---
    const sql = `
      SELECT ${selectCols.join(', ')}
      FROM routes r
      LEFT JOIN users u ON u.id = r.contributor_user_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY rank_score DESC, r.id ASC
      LIMIT ${limit + 1}
    `;

    const { data, error } = await this.supabase.rpc('search_routes_raw', {
      query_sql: sql,
      query_params: params,
    });

    // Fallback: if the RPC doesn't exist yet, use a simpler approach
    if (error) {
      this.logger.warn(
        `search_routes_raw RPC failed: ${error.message}, falling back to basic query`,
      );
      return this.searchRoutesFallback(q, near, filters, limit, after);
    }

    const rows = (data ?? []) as SearchRouteRow[];
    return this.buildConnection(rows, limit);
  }

  /** Fallback search using Supabase client (no PostGIS ranking) */
  private async searchRoutesFallback(
    q?: string,
    _near?: LatLngInput,
    filters?: SearchRoutesFilterInput,
    limit = 20,
    after?: string,
  ): Promise<RouteSearchConnection> {
    let query = this.supabase
      .from('routes')
      .select(
        'id, name, description, polyline, distance_m, elevation_gain_m, surface_type, curvature_index, is_motovault_pick, editorial_description, rating_avg, rating_count, comment_count, status, created_at, contributor_user_id, users:contributor_user_id(id, display_name, public_username, avatar_url)',
      )
      .eq('status', 'published')
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(limit + 1);

    // Text search via ilike — sanitize input to prevent PostgREST filter manipulation
    if (q) {
      const sanitized = q.replace(/[%_.,()]/g, '');
      if (sanitized.length > 0) {
        query = query.ilike('name', `%${sanitized}%`);
      }
    }

    if (filters?.surfaceTypes && filters.surfaceTypes.length > 0) {
      query = query.in('surface_type', filters.surfaceTypes);
    }
    if (filters?.minKm != null) {
      query = query.gte('distance_m', filters.minKm * 1000);
    }
    if (filters?.maxKm != null) {
      query = query.lte('distance_m', filters.maxKm * 1000);
    }
    if (filters?.countryCode) {
      query = query.eq('country_code', filters.countryCode);
    }
    if (filters?.regionCode) {
      query = query.eq('region_code', filters.regionCode);
    }

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        query = query.lt('rating_avg', cursor.score);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`searchRoutesFallback failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to search routes');
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => {
      const users = row.users as {
        id: string;
        display_name: string | null;
        public_username: string | null;
        avatar_url: string | null;
      } | null;

      const score = (row.rating_avg as number | null) ?? 0;

      return {
        node: {
          id: row.id as string,
          name: (row.name as string | null) ?? undefined,
          description: (row.description as string | null) ?? undefined,
          polyline: row.polyline as string,
          distanceM: row.distance_m as number,
          elevationGainM: (row.elevation_gain_m as number | null) ?? undefined,
          surfaceType: (row.surface_type as string | null) ?? undefined,
          curvatureIndex: (row.curvature_index as number | null) ?? undefined,
          isMotovaultPick: row.is_motovault_pick as boolean,
          editorialDescription: (row.editorial_description as string | null) ?? undefined,
          ratingAvg: (row.rating_avg as number | null) ?? undefined,
          ratingCount: row.rating_count as number,
          commentCount: row.comment_count as number,
          status: row.status as string,
          createdAt: row.created_at as string,
          contributor: {
            id: users?.id ?? (row.contributor_user_id as string),
            displayName: users?.display_name ?? 'Rider',
            publicUsername: users?.public_username ?? undefined,
            avatarUrl: users?.avatar_url ?? undefined,
          },
        },
        cursor: encodeCursor(score, row.id as string),
        score,
      };
    });

    const lastEdge = edges[edges.length - 1];

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: lastEdge?.cursor,
      },
    };
  }

  private buildConnection(rows: SearchRouteRow[], limit: number): RouteSearchConnection {
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => ({
      node: {
        id: row.id,
        name: row.name ?? undefined,
        description: row.description ?? undefined,
        polyline: row.polyline,
        distanceM: row.distance_m,
        elevationGainM: row.elevation_gain_m ?? undefined,
        surfaceType: row.surface_type ?? undefined,
        curvatureIndex: row.curvature_index ?? undefined,
        isMotovaultPick: row.is_motovault_pick,
        editorialDescription: row.editorial_description ?? undefined,
        ratingAvg: row.rating_avg ?? undefined,
        ratingCount: row.rating_count,
        commentCount: row.comment_count,
        status: row.status,
        createdAt: row.created_at,
        contributor: {
          id: row.contributor_user_id,
          displayName: row.contributor_display_name ?? 'Rider',
          publicUsername: row.contributor_username ?? undefined,
          avatarUrl: row.contributor_avatar_url ?? undefined,
        },
        startLat: row.start_lat ?? undefined,
        startLng: row.start_lng ?? undefined,
      },
      cursor: encodeCursor(row.rank_score, row.id),
      score: row.rank_score,
    }));

    const lastEdge = edges[edges.length - 1];

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: lastEdge?.cursor,
      },
    };
  }

  async typeahead(
    q: string | null,
    _near: { lat: number; lng: number } | null,
    limit: number,
  ): Promise<TypeaheadResult> {
    if (!q || q.trim() === '') {
      return { routes: [], places: [] };
    }

    const sanitized = q.trim().slice(0, MAX_QUERY_LENGTH);
    const safeLimit = Math.min(Math.max(limit, 1), MAX_TYPEAHEAD_LIMIT);

    const { data, error } = await this.supabase.rpc('typeahead_search', {
      search_term: sanitized,
      result_limit: safeLimit,
    });

    if (error) {
      this.logger.error(`Typeahead search failed: ${error.message}`, error);
      return { routes: [], places: [] };
    }

    const rows = (data ?? []) as Array<{
      source: string;
      id: string | number;
      name: string;
      slug: string | null;
      kind: string | null;
      country_code: string;
      region_code: string | null;
      population: number | null;
      sim: number;
    }>;

    const routes = rows
      .filter((r) => r.source === 'route')
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        slug: r.slug ?? '',
        countryCode: r.country_code,
        regionCode: r.region_code ?? undefined,
      }));

    const places = rows
      .filter((r) => r.source === 'place')
      .map((r) => ({
        id: Number(r.id),
        name: r.name,
        kind: r.kind ?? '',
        countryCode: r.country_code,
        regionCode: r.region_code ?? undefined,
        population: r.population ?? 0,
      }));

    return { routes, places };
  }
}
