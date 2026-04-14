import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Route, RouteConnection, RouteContributor } from './models/route.model';

/** Row shape from route_saves JOIN routes JOIN users */
interface SavedRouteRow {
  route_id: string;
  saved_at: string;
  routes: {
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
    start_lat?: number;
    start_lng?: number;
    users: {
      id: string;
      display_name: string | null;
      public_username: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

@Injectable()
export class SavedRoutesService {
  private readonly logger = new Logger(SavedRoutesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  // ==========================================
  // Save / Unsave
  // ==========================================

  async saveRoute(userId: string, routeId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('route_saves')
      .insert({ route_id: routeId, user_id: userId });

    if (error) {
      if (error.code === '23505') return true; // Already saved — idempotent
      this.logger.error(`saveRoute failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to save route');
    }
    return true;
  }

  async unsaveRoute(userId: string, routeId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('route_saves')
      .delete()
      .eq('route_id', routeId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`unsaveRoute failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to unsave route');
    }
    return true;
  }

  // ==========================================
  // Is Route Saved (single + batch)
  // ==========================================

  async isRouteSaved(userId: string, routeId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('route_saves')
      .select('route_id')
      .eq('user_id', userId)
      .eq('route_id', routeId)
      .maybeSingle();

    if (error) {
      this.logger.error(`isRouteSaved failed: ${error.message}`);
      return false;
    }
    return !!data;
  }

  /** Batch check for DataLoader — returns Map<routeId, boolean> */
  async areRoutesSaved(userId: string, routeIds: string[]): Promise<Map<string, boolean>> {
    const { data, error } = await this.supabase
      .from('route_saves')
      .select('route_id')
      .eq('user_id', userId)
      .in('route_id', routeIds);

    const result = new Map<string, boolean>();
    for (const id of routeIds) {
      result.set(id, false);
    }

    if (error) {
      this.logger.error(`areRoutesSaved batch failed: ${error.message}`);
      return result;
    }

    for (const row of data ?? []) {
      result.set(row.route_id as string, true);
    }
    return result;
  }

  // ==========================================
  // User's Saved Routes (authenticated)
  // ==========================================

  async getUserSavedRoutes(
    userId: string,
    first: number,
    after?: string,
  ): Promise<RouteConnection> {
    const limit = Math.min(first, 50);

    let query = this.supabase
      .from('route_saves')
      .select(
        'route_id, saved_at, routes:route_id(id, name, description, polyline, distance_m, elevation_gain_m, surface_type, curvature_index, is_motovault_pick, editorial_description, rating_avg, rating_count, comment_count, status, created_at, contributor_user_id, start_lat, start_lng, users:contributor_user_id(id, display_name, public_username, avatar_url))',
      )
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = this.decodeCursor(after);
      query = query.or(
        `saved_at.lt.${decoded.savedAt},and(saved_at.eq.${decoded.savedAt},route_id.gt.${decoded.routeId})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getUserSavedRoutes failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch saved routes');
    }

    const rows = (data ?? []) as unknown as SavedRouteRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced
      .filter((row) => row.routes != null)
      .map((row) => {
        const node = this.mapSavedRouteRow(row);
        return {
          node,
          cursor: this.encodeCursor(row.saved_at, row.route_id),
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

  // ==========================================
  // Public Saved Routes (by handle/public_username)
  // ==========================================

  async getPublicSavedRoutes(
    handle: string,
    first: number,
    after?: string,
  ): Promise<RouteConnection> {
    // 1. Look up user by public_username and check is_public
    const { data: user, error: userError } = await this.supabaseAdmin
      .from('users')
      .select('id, is_public')
      .eq('public_username', handle)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_public) {
      throw new NotFoundException('User profile is not public');
    }

    // 2. Fetch saved routes using admin client (RLS on route_saves is owner-only)
    const limit = Math.min(first, 50);

    let query = this.supabaseAdmin
      .from('route_saves')
      .select(
        'route_id, saved_at, routes:route_id(id, name, description, polyline, distance_m, elevation_gain_m, surface_type, curvature_index, is_motovault_pick, editorial_description, rating_avg, rating_count, comment_count, status, created_at, contributor_user_id, start_lat, start_lng, users:contributor_user_id(id, display_name, public_username, avatar_url))',
      )
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = this.decodeCursor(after);
      query = query.or(
        `saved_at.lt.${decoded.savedAt},and(saved_at.eq.${decoded.savedAt},route_id.gt.${decoded.routeId})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getPublicSavedRoutes failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch public saved routes');
    }

    const rows = (data ?? []) as unknown as SavedRouteRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced
      .filter((row) => row.routes != null)
      .map((row) => {
        const node = this.mapSavedRouteRow(row);
        return {
          node,
          cursor: this.encodeCursor(row.saved_at, row.route_id),
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

  // ==========================================
  // Private helpers
  // ==========================================

  private mapSavedRouteRow(row: SavedRouteRow): Route {
    const r = row.routes;
    if (!r) {
      throw new InternalServerErrorException('Saved route row missing joined route');
    }
    const contributor: RouteContributor = {
      id: r.users?.id ?? r.contributor_user_id,
      displayName: r.users?.display_name ?? 'Rider',
      publicUsername: r.users?.public_username ?? undefined,
      avatarUrl: r.users?.avatar_url ?? undefined,
    };

    return {
      id: r.id,
      name: r.name ?? undefined,
      description: r.description ?? undefined,
      polyline: r.polyline,
      distanceM: r.distance_m,
      elevationGainM: r.elevation_gain_m ?? undefined,
      surfaceType: r.surface_type ?? undefined,
      curvatureIndex: r.curvature_index ?? undefined,
      isMotovaultPick: r.is_motovault_pick,
      editorialDescription: r.editorial_description ?? undefined,
      ratingAvg: r.rating_avg ?? undefined,
      ratingCount: r.rating_count,
      commentCount: r.comment_count,
      status: r.status,
      createdAt: r.created_at,
      contributor,
      startLat: r.start_lat ?? undefined,
      startLng: r.start_lng ?? undefined,
    };
  }

  /** Encode (saved_at, route_id) composite cursor */
  private encodeCursor(savedAt: string, routeId: string): string {
    return Buffer.from(`${savedAt}|${routeId}`).toString('base64');
  }

  /** Decode composite cursor → { savedAt, routeId } */
  private decodeCursor(cursor: string): { savedAt: string; routeId: string } {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split('|');
    if (parts.length !== 2 || Number.isNaN(Date.parse(parts[0]))) {
      throw new BadRequestException('Invalid cursor');
    }
    return { savedAt: parts[0], routeId: parts[1] };
  }
}
