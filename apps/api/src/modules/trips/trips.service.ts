import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Trip, TripConnection, TripWaypoint } from './models/trip.model';

/** Shape returned by trips + users join */
interface TripRow {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  difficulty: string;
  max_riders: number;
  participant_count: number;
  status: string;
  cover_image_url: string | null;
  created_at: string;
  organiser_user_id: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

/** Shape returned by trip_waypoints */
interface WaypointRow {
  id: string;
  trip_id: string;
  sort_order: number;
  day_index: number;
  type: string;
  name: string;
  notes: string | null;
  lat: number;
  lng: number;
  created_at: string;
}

/** Shape returned by trip_participants + users join */
interface ParticipantRow {
  user_id: string;
  role: string;
  status: string;
  bike_id: string | null;
  joined_at: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

const TRIP_SELECT =
  'id, title, description, start_date, end_date, difficulty, max_riders, participant_count, status, cover_image_url, created_at, organiser_user_id, users:organiser_user_id(id, display_name, public_username, avatar_url)';

function mapRowToTrip(row: TripRow): Trip {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    difficulty: row.difficulty,
    maxRiders: row.max_riders,
    participantCount: row.participant_count,
    status: row.status,
    coverImageUrl: row.cover_image_url ?? undefined,
    createdAt: row.created_at,
    organiser: {
      id: row.users?.id ?? row.organiser_user_id,
      displayName: row.users?.display_name ?? 'Rider',
      publicUsername: row.users?.public_username ?? undefined,
      avatarUrl: row.users?.avatar_url ?? undefined,
    },
  };
}

function mapRowToWaypoint(row: WaypointRow): TripWaypoint {
  return {
    id: row.id,
    tripId: row.trip_id,
    sortOrder: row.sort_order,
    dayIndex: row.day_index,
    type: row.type,
    name: row.name,
    notes: row.notes ?? undefined,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
  };
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  // ==========================================
  // Queries
  // ==========================================

  async getTrips(first: number, after?: string): Promise<TripConnection> {
    const limit = Math.min(first, 50);

    let query = this.supabaseAdmin
      .from('trips')
      .select(TRIP_SELECT)
      .in('status', ['published', 'active'])
      .order('start_date', { ascending: true })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      query = query.gt('start_date', decoded);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getTrips failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch trips');
    }

    const rows = (data ?? []) as unknown as TripRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => {
      const node = mapRowToTrip(row);
      return {
        node,
        cursor: Buffer.from(row.start_date).toString('base64'),
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

  async myTrips(userId: string, first: number, after?: string): Promise<TripConnection> {
    const limit = Math.min(first, 50);

    // Two-step: get participating trip IDs, then fetch trips via user client (RLS-enforced)
    const { data: participatingIds } = await this.supabase
      .from('trip_participants')
      .select('trip_id')
      .eq('user_id', userId);

    const participantTripIds = (participatingIds ?? []).map((r) => r.trip_id as string);

    // Use supabase (user JWT) — RLS enforces visibility
    let query = this.supabase
      .from('trips')
      .select(TRIP_SELECT)
      .order('start_date', { ascending: false })
      .limit(limit + 1);

    // Filter: organiser OR participant
    if (participantTripIds.length > 0) {
      query = query.or(`organiser_user_id.eq.${userId},id.in.(${participantTripIds.join(',')})`);
    } else {
      query = query.eq('organiser_user_id', userId);
    }

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      query = query.lt('start_date', decoded);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`myTrips failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch my trips');
    }

    const rows = (data ?? []) as unknown as TripRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => ({
      node: mapRowToTrip(row),
      cursor: Buffer.from(row.start_date).toString('base64'),
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

  async tripDetail(tripId: string): Promise<Trip> {
    // Fetch trip — supabaseAdmin for public endpoint (no JWT on @Public() queries)
    const { data: tripData, error: tripError } = await this.supabaseAdmin
      .from('trips')
      .select(TRIP_SELECT)
      .eq('id', tripId)
      .in('status', ['published', 'active', 'completed'])
      .single();

    if (tripError || !tripData) {
      if (tripError?.code === 'PGRST116') {
        throw new NotFoundException('Trip not found');
      }
      this.logger.error(`tripDetail failed: ${tripError?.message} (${tripError?.code})`);
      throw new InternalServerErrorException('Failed to fetch trip');
    }

    const row = tripData as unknown as TripRow;
    const trip = mapRowToTrip(row);

    // Fetch waypoints + participants in parallel (no data dependency)
    const [waypointResult, participantResult] = await Promise.all([
      this.supabaseAdmin
        .from('trip_waypoints')
        .select('*')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),
      this.supabaseAdmin
        .from('trip_participants')
        .select(
          'user_id, role, status, bike_id, joined_at, users:user_id(id, display_name, public_username, avatar_url)',
        )
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true }),
    ]);

    if (waypointResult.data) {
      trip.waypoints = (waypointResult.data as unknown as WaypointRow[]).map(mapRowToWaypoint);
    }

    if (participantResult.data) {
      trip.participants = (participantResult.data as unknown as ParticipantRow[]).map((p) => ({
        id: p.users?.id ?? p.user_id,
        displayName: p.users?.display_name ?? 'Rider',
        publicUsername: p.users?.public_username ?? undefined,
        avatarUrl: p.users?.avatar_url ?? undefined,
        role: p.role,
        status: p.status,
        bikeId: p.bike_id ?? undefined,
        joinedAt: p.joined_at,
      }));
    }

    return trip;
  }

  // ==========================================
  // Trip Mutations
  // ==========================================

  async createTrip(
    userId: string,
    input: {
      title: string;
      description: string;
      startDate: string;
      endDate: string;
      difficulty: string;
      maxRiders: number;
    },
  ): Promise<Trip> {
    const { data, error } = await this.supabase
      .from('trips')
      .insert({
        organiser_user_id: userId,
        title: input.title,
        description: input.description,
        start_date: input.startDate,
        end_date: input.endDate,
        difficulty: input.difficulty,
        max_riders: input.maxRiders,
      })
      .select(TRIP_SELECT)
      .single();

    if (error) {
      this.logger.error(`createTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to create trip');
    }

    return mapRowToTrip(data as unknown as TripRow);
  }

  async createTripWithWaypoints(
    userId: string,
    input: {
      title: string;
      description: string;
      startDate: string;
      endDate: string;
      difficulty: string;
      maxRiders: number;
      waypoints: Array<{
        type: string;
        name: string;
        lat: number;
        lng: number;
        notes?: string;
        sortOrder: number;
      }>;
    },
  ): Promise<Trip> {
    // Create trip
    const { data: tripData, error: tripError } = await this.supabase
      .from('trips')
      .insert({
        organiser_user_id: userId,
        title: input.title,
        description: input.description,
        start_date: input.startDate,
        end_date: input.endDate,
        difficulty: input.difficulty,
        max_riders: input.maxRiders,
      })
      .select(TRIP_SELECT)
      .single();

    if (tripError) {
      this.logger.error(
        `createTripWithWaypoints trip failed: ${tripError.message} (${tripError.code})`,
      );
      throw new InternalServerErrorException('Failed to create trip');
    }

    const trip = mapRowToTrip(tripData as unknown as TripRow);

    // Insert all waypoints in one batch
    if (input.waypoints.length > 0) {
      const waypointRows = input.waypoints.map((wp) => ({
        trip_id: trip.id,
        type: wp.type,
        name: wp.name,
        lat: wp.lat,
        lng: wp.lng,
        notes: wp.notes ?? null,
        sort_order: wp.sortOrder,
        day_index: wp.dayIndex ?? 0,
      }));

      const { data: waypointData, error: wpError } = await this.supabase
        .from('trip_waypoints')
        .insert(waypointRows)
        .select('*');

      if (wpError) {
        this.logger.error(
          `createTripWithWaypoints waypoints failed: ${wpError.message} (${wpError.code})`,
        );
        // Trip was created but waypoints failed — clean up
        await this.supabase.from('trips').delete().eq('id', trip.id);
        throw new InternalServerErrorException('Failed to create trip waypoints');
      }

      if (waypointData) {
        trip.waypoints = (waypointData as unknown as WaypointRow[]).map(mapRowToWaypoint);
      }
    }

    return trip;
  }

  async updateTrip(
    userId: string,
    tripId: string,
    input: {
      title?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      difficulty?: string;
      maxRiders?: number;
    },
  ): Promise<Trip> {
    await this.verifyOrganiser(userId, tripId);

    const update: Record<string, unknown> = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.startDate !== undefined) update.start_date = input.startDate;
    if (input.endDate !== undefined) update.end_date = input.endDate;
    if (input.difficulty !== undefined) update.difficulty = input.difficulty;
    if (input.maxRiders !== undefined) update.max_riders = input.maxRiders;

    const { data, error } = await this.supabase
      .from('trips')
      .update(update)
      .eq('id', tripId)
      .select(TRIP_SELECT)
      .single();

    if (error) {
      this.logger.error(`updateTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to update trip');
    }

    return mapRowToTrip(data as unknown as TripRow);
  }

  async deleteTrip(userId: string, tripId: string): Promise<boolean> {
    await this.verifyOrganiser(userId, tripId);

    const { error } = await this.supabase.from('trips').delete().eq('id', tripId);

    if (error) {
      this.logger.error(`deleteTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to delete trip');
    }

    return true;
  }

  async publishTrip(userId: string, tripId: string): Promise<Trip> {
    const existing = await this.verifyOrganiser(userId, tripId);

    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft trips can be published');
    }

    const { data, error } = await this.supabase
      .from('trips')
      .update({ status: 'published' })
      .eq('id', tripId)
      .select(TRIP_SELECT)
      .single();

    if (error) {
      this.logger.error(`publishTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to publish trip');
    }

    return mapRowToTrip(data as unknown as TripRow);
  }

  // ==========================================
  // Waypoint Mutations
  // ==========================================

  async addWaypoint(
    userId: string,
    input: {
      tripId: string;
      type: string;
      name: string;
      lat: number;
      lng: number;
      notes?: string;
      sortOrder: number;
    },
  ): Promise<TripWaypoint> {
    await this.verifyOrganiser(userId, input.tripId);

    const { data, error } = await this.supabase
      .from('trip_waypoints')
      .insert({
        trip_id: input.tripId,
        type: input.type,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        notes: input.notes ?? null,
        sort_order: input.sortOrder,
        day_index: input.dayIndex ?? 0,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`addWaypoint failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to add waypoint');
    }

    return mapRowToWaypoint(data as unknown as WaypointRow);
  }

  async updateWaypoint(
    userId: string,
    waypointId: string,
    input: {
      type?: string;
      name?: string;
      lat?: number;
      lng?: number;
      notes?: string;
      sortOrder?: number;
    },
  ): Promise<TripWaypoint> {
    // Get waypoint to find trip_id
    const { data: wp, error: wpError } = await this.supabase
      .from('trip_waypoints')
      .select('trip_id')
      .eq('id', waypointId)
      .single();

    if (wpError || !wp) {
      throw new NotFoundException('Waypoint not found');
    }

    await this.verifyOrganiser(userId, wp.trip_id);

    const update: Record<string, unknown> = {};
    if (input.type !== undefined) update.type = input.type;
    if (input.name !== undefined) update.name = input.name;
    if (input.lat !== undefined) update.lat = input.lat;
    if (input.lng !== undefined) update.lng = input.lng;
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
    if (input.dayIndex !== undefined) update.day_index = input.dayIndex;

    const { data, error } = await this.supabase
      .from('trip_waypoints')
      .update(update)
      .eq('id', waypointId)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`updateWaypoint failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to update waypoint');
    }

    return mapRowToWaypoint(data as unknown as WaypointRow);
  }

  async removeWaypoint(userId: string, waypointId: string): Promise<boolean> {
    // Get waypoint to find trip_id
    const { data: wp, error: wpError } = await this.supabase
      .from('trip_waypoints')
      .select('trip_id')
      .eq('id', waypointId)
      .single();

    if (wpError || !wp) {
      throw new NotFoundException('Waypoint not found');
    }

    await this.verifyOrganiser(userId, wp.trip_id);

    const { error } = await this.supabase.from('trip_waypoints').delete().eq('id', waypointId);

    if (error) {
      this.logger.error(`removeWaypoint failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to remove waypoint');
    }

    return true;
  }

  async reorderWaypoints(userId: string, tripId: string, waypointIds: string[]): Promise<boolean> {
    await this.verifyOrganiser(userId, tripId);

    // Atomic reorder via RPC — single transaction
    const { error } = await this.supabaseAdmin.rpc('reorder_trip_waypoints', {
      p_trip_id: tripId,
      p_waypoint_ids: waypointIds,
    });

    if (error) {
      this.logger.error(`reorderWaypoints failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to reorder waypoints');
    }

    return true;
  }

  // ==========================================
  // Participant Mutations
  // ==========================================

  async joinTrip(
    userId: string,
    tripId: string,
    status: string = 'going',
    bikeId?: string,
  ): Promise<boolean> {
    // Use atomic RPC with row-level locking to prevent race conditions
    const { error } = await this.supabase.rpc('join_trip', {
      p_trip_id: tripId,
      p_user_id: userId,
      p_status: status,
      p_bike_id: bikeId ?? null,
    });

    if (error) {
      if (error.message.includes('Cannot join')) {
        throw new BadRequestException(error.message.replace('Cannot join: ', ''));
      }
      this.logger.error(`joinTrip failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to join trip');
    }

    return true;
  }

  async updateParticipantStatus(userId: string, tripId: string, status: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('trip_participants')
      .update({ status })
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select('user_id')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        throw new BadRequestException('You are not a participant in this trip');
      }
      this.logger.error(`updateParticipantStatus failed: ${error?.message}`);
      throw new InternalServerErrorException('Failed to update status');
    }

    return true;
  }

  async leaveTrip(userId: string, tripId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('trip_participants')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select('user_id')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        throw new BadRequestException('You are not a participant in this trip');
      }
      this.logger.error(`leaveTrip failed: ${error?.message}`);
      throw new InternalServerErrorException('Failed to leave trip');
    }

    return true;
  }

  // ==========================================
  // Helpers
  // ==========================================

  private async verifyOrganiser(userId: string, tripId: string): Promise<{ status: string }> {
    const { data: existing, error } = await this.supabase
      .from('trips')
      .select('organiser_user_id, status')
      .eq('id', tripId)
      .single();

    if (error || !existing) {
      if (error?.code === 'PGRST116') {
        throw new NotFoundException('Trip not found');
      }
      this.logger.error(`verifyOrganiser failed: ${error?.message}`);
      throw new InternalServerErrorException('Failed to verify trip');
    }

    if (existing.organiser_user_id !== userId) {
      throw new ForbiddenException('Only the organiser can modify this trip');
    }

    return { status: existing.status };
  }
}
