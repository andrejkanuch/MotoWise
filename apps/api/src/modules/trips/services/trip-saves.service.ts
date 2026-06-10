import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeCursor, encodeCursor } from '../../../common/pagination/connection';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { TripConnection } from '../models/trip.model';
import { mapRowToTrip, TRIP_DETAIL_SELECT, type TripRow } from './trip-lifecycle.service';

/** Row shape for trip_saves join */
interface SaveRow {
  id: string;
  trip_id: string;
  user_id: string;
  saved_at: string;
}

@Injectable()
export class TripSavesService {
  private readonly logger = new Logger(TripSavesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async saveTrip(userId: string, tripId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('trip_saves')
      .insert({ user_id: userId, trip_id: tripId });

    if (error) {
      // Unique constraint violation = already saved, treat as success
      if (error.code === '23505') return true;
      this.logger.error(`saveTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to save trip');
    }

    return true;
  }

  async unsaveTrip(userId: string, tripId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('trip_saves')
      .delete()
      .eq('user_id', userId)
      .eq('trip_id', tripId);

    if (error) {
      this.logger.error(`unsaveTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to unsave trip');
    }

    return true;
  }

  async isTripSaved(userId: string, tripId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('trip_saves')
      .select('id')
      .eq('user_id', userId)
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) {
      this.logger.error(`isTripSaved failed: ${error.message} (${error.code})`);
      return false;
    }

    return data !== null;
  }

  async savedTrips(userId: string, first: number, after?: string): Promise<TripConnection> {
    const limit = Math.min(first, 50);

    // Fetch saved trip IDs with cursor pagination on the save timestamp
    let savesQuery = this.supabase
      .from('trip_saves')
      .select('id, trip_id, saved_at')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = decodeCursor(after);
      if (decoded) {
        const [savedAt, id] = decoded;
        savesQuery = savesQuery.or(
          `saved_at.lt.${savedAt},and(saved_at.eq.${savedAt},id.lt.${id})`,
        );
      }
    }

    const { data: saves, error: savesError } = await savesQuery;
    if (savesError) {
      this.logger.error(`savedTrips saves query failed: ${savesError.message}`);
      throw new InternalServerErrorException('Failed to fetch saved trips');
    }

    const saveRows = (saves ?? []) as unknown as SaveRow[];
    const hasNextPage = saveRows.length > limit;
    const sliced = saveRows.slice(0, limit);

    if (sliced.length === 0) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false },
      };
    }

    // Fetch the actual trip rows
    const tripIds = sliced.map((s) => s.trip_id);
    // Use TRIP_DETAIL_SELECT: the list select omits template fields (polyline,
    // distance, ratings, etc.) so saved template trips rendered with blanks.
    const { data: trips, error: tripsError } = await this.supabase
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .in('id', tripIds);

    if (tripsError) {
      this.logger.error(`savedTrips trips query failed: ${tripsError.message}`);
      throw new InternalServerErrorException('Failed to fetch saved trips');
    }

    // Index trips by ID for O(1) lookup
    const tripMap = new Map<string, TripRow>();
    for (const row of (trips ?? []) as unknown as TripRow[]) {
      tripMap.set(row.id, row);
    }

    // Build edges in save order, filtering out any trips that RLS hid
    const edges = sliced
      .filter((save) => tripMap.has(save.trip_id))
      .map((save) => {
        // biome-ignore lint/style/noNonNullAssertion: guarded by tripMap.has() filter above
        const tripRow = tripMap.get(save.trip_id)!;
        return {
          node: mapRowToTrip(tripRow, userId),
          cursor: encodeCursor(save.saved_at, save.id),
        };
      });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      },
    };
  }

  // ==========================================
  // Public Saved Trips (by handle/public_username)
  // ==========================================

  async publicSavedTrips(handle: string, first: number, after?: string): Promise<TripConnection> {
    // 1. Look up user by public_username and check is_public
    const { data: user, error: userError } = await this.supabaseAdmin
      .from('users')
      .select('id, is_public')
      .eq('public_username', handle)
      .single();

    if (userError || !user || !user.is_public) {
      throw new NotFoundException('Profile not found');
    }

    // 2. Fetch saved trip IDs using admin client (RLS on trip_saves is owner-only)
    const limit = Math.min(first, 50);

    let savesQuery = this.supabaseAdmin
      .from('trip_saves')
      .select('id, trip_id, saved_at')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = decodeCursor(after);
      if (decoded) {
        const [savedAt, id] = decoded;
        savesQuery = savesQuery.or(
          `saved_at.lt.${savedAt},and(saved_at.eq.${savedAt},id.lt.${id})`,
        );
      }
    }

    const { data: saves, error: savesError } = await savesQuery;
    if (savesError) {
      this.logger.error(`publicSavedTrips saves query failed: ${savesError.message}`);
      throw new InternalServerErrorException('Failed to fetch public saved trips');
    }

    const saveRows = (saves ?? []) as unknown as SaveRow[];
    const hasNextPage = saveRows.length > limit;
    const sliced = saveRows.slice(0, limit);

    if (sliced.length === 0) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false },
      };
    }

    // 3. Fetch the actual trip rows with template fields
    const tripIds = sliced.map((s) => s.trip_id);
    const { data: trips, error: tripsError } = await this.supabaseAdmin
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .in('id', tripIds)
      .eq('is_flagged', false)
      .in('visibility', ['public']);

    if (tripsError) {
      this.logger.error(`publicSavedTrips trips query failed: ${tripsError.message}`);
      throw new InternalServerErrorException('Failed to fetch public saved trips');
    }

    // Index trips by ID for O(1) lookup
    const tripMap = new Map<string, TripRow>();
    for (const row of (trips ?? []) as unknown as TripRow[]) {
      tripMap.set(row.id, row);
    }

    // Build edges in save order, filtering out any missing trips
    const edges = sliced
      .filter((save) => tripMap.has(save.trip_id))
      .map((save) => {
        // biome-ignore lint/style/noNonNullAssertion: guarded by tripMap.has() filter above
        const tripRow = tripMap.get(save.trip_id)!;
        return {
          node: mapRowToTrip(tripRow),
          cursor: encodeCursor(save.saved_at, save.id),
        };
      });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      },
    };
  }
}
