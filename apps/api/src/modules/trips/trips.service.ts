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
  visibility: string;
  cover_image_url: string | null;
  created_at: string;
  organiser_user_id: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
    is_public: boolean | null;
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
  'id, title, description, start_date, end_date, difficulty, max_riders, participant_count, status, visibility, cover_image_url, created_at, organiser_user_id, users:organiser_user_id(id, display_name, public_username, avatar_url, is_public)';

/**
 * Redact organiser PII fields when the organiser has is_public=false
 * and the caller is neither the organiser nor a participant.
 * displayName is preserved; publicUsername and avatarUrl are cleared.
 */
function redactOrganiser(
  organiser: Trip['organiser'],
  isPublic: boolean,
  callerUserId: string | undefined,
  isParticipant: boolean,
): Trip['organiser'] {
  if (isPublic) return organiser;
  if (callerUserId && callerUserId === organiser.id) return organiser;
  if (isParticipant) return organiser;
  return {
    ...organiser,
    publicUsername: undefined,
    avatarUrl: undefined,
  };
}

function mapRowToTrip(row: TripRow, callerUserId?: string, isParticipant = false): Trip {
  const organiser = {
    id: row.users?.id ?? row.organiser_user_id,
    displayName: row.users?.display_name ?? 'Rider',
    publicUsername: row.users?.public_username ?? undefined,
    avatarUrl: row.users?.avatar_url ?? undefined,
  };
  const isPublic = row.users?.is_public !== false;
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
    visibility: row.visibility ?? 'private',
    coverImageUrl: row.cover_image_url ?? undefined,
    createdAt: row.created_at,
    organiser: redactOrganiser(organiser, isPublic, callerUserId, isParticipant),
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

    // Use per-request user client so RLS enforces visibility. Explicit
    // visibility='public' filter is defense-in-depth for the Discover feed.
    let query = this.supabase
      .from('trips')
      .select(TRIP_SELECT)
      .in('status', ['published', 'active'])
      .eq('visibility', 'public')
      .order('start_date', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      const [startDate, id] = decoded.split('|');
      if (startDate && id) {
        // Composite cursor: rows strictly after (start_date, id)
        query = query.or(`start_date.gt.${startDate},and(start_date.eq.${startDate},id.gt.${id})`);
      } else if (startDate) {
        // Back-compat for legacy single-column cursors
        query = query.gt('start_date', startDate);
      }
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
        cursor: Buffer.from(`${row.start_date}|${row.id}`).toString('base64'),
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

    // Defense-in-depth: only allow well-formed UUIDs into the .or() string
    // below. participantTripIds come from the DB so should already be safe,
    // but we filter anyway to remove any chance of SQL injection via the
    // string-interpolated PostgREST filter.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const participantTripIds = (participatingIds ?? [])
      .map((r) => r.trip_id as string)
      .filter((id) => UUID_RE.test(id));

    // Use supabase (user JWT) — RLS enforces visibility
    let query = this.supabase
      .from('trips')
      .select(TRIP_SELECT)
      .order('start_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    // Filter: organiser OR participant
    if (participantTripIds.length > 0) {
      query = query.or(`organiser_user_id.eq.${userId},id.in.(${participantTripIds.join(',')})`);
    } else {
      query = query.eq('organiser_user_id', userId);
    }

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      const [startDate, id] = decoded.split('|');
      if (startDate && id) {
        // myTrips is ordered DESC, so "after" means strictly before
        // (start_date, id).
        query = query.or(`start_date.lt.${startDate},and(start_date.eq.${startDate},id.lt.${id})`);
      } else if (startDate) {
        query = query.lt('start_date', startDate);
      }
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
      // Caller is always organiser or participant of their own trips — no
      // organiser redaction needed.
      node: mapRowToTrip(row, userId, true),
      cursor: Buffer.from(`${row.start_date}|${row.id}`).toString('base64'),
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

  async tripDetail(tripId: string, callerUserId?: string): Promise<Trip> {
    // Use the per-request user client so RLS enforces visibility:
    // - Organiser sees their own trips in any status (incl. drafts)
    // - Everyone else sees trips allowed by the visibility policy
    //   (public to anyone, unlisted/private per invite rules)
    const { data: tripData, error: tripError } = await this.supabase
      .from('trips')
      .select(TRIP_SELECT)
      .eq('id', tripId)
      .single();

    if (tripError || !tripData) {
      if (tripError?.code === 'PGRST116') {
        throw new NotFoundException('Trip not found');
      }
      this.logger.error(`tripDetail failed: ${tripError?.message} (${tripError?.code})`);
      throw new InternalServerErrorException('Failed to fetch trip');
    }

    const row = tripData as unknown as TripRow;

    // Fetch waypoints + participants in parallel via the per-request user
    // client so RLS enforces visibility (defence-in-depth alongside the
    // trip-row RLS check above).
    const [waypointResult, participantResult] = await Promise.all([
      this.supabase
        .from('trip_waypoints')
        .select('*')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true }),
      this.supabase
        .from('trip_participants')
        .select(
          'user_id, role, status, bike_id, joined_at, users:user_id(id, display_name, public_username, avatar_url)',
        )
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true }),
    ]);

    const participantRows = (participantResult.data ?? []) as unknown as ParticipantRow[];
    const isCallerParticipant = callerUserId
      ? participantRows.some((p) => p.user_id === callerUserId)
      : false;

    const trip = mapRowToTrip(row, callerUserId, isCallerParticipant);

    if (waypointResult.data) {
      trip.waypoints = (waypointResult.data as unknown as WaypointRow[]).map(mapRowToWaypoint);
    }

    if (participantResult.data) {
      trip.participants = participantRows.map((p) => ({
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
      visibility?: string;
      waypoints: Array<{
        type: string;
        name: string;
        lat: number;
        lng: number;
        notes?: string;
        sortOrder: number;
        dayIndex?: number;
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
        // Privacy feature: default 'private' when not specified. The organizer
        // must explicitly opt in to unlisted/public visibility.
        ...(input.visibility && { visibility: input.visibility }),
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

    // Auto-enrol the organiser as the first rider (going). The
    // trg_update_trip_participant_count trigger bumps participant_count to 1
    // so the UI can always say "1/N riders" on a fresh trip instead of "0/N".
    const { error: organiserParticipantError } = await this.supabase
      .from('trip_participants')
      .insert({
        trip_id: trip.id,
        user_id: userId,
        role: 'organizer',
        status: 'going',
      });

    if (organiserParticipantError) {
      this.logger.error(
        `createTripWithWaypoints organiser participant failed: ${organiserParticipantError.message} (${organiserParticipantError.code})`,
      );
      // Roll back the trip so we don't leak an orphaned row.
      await this.supabase.from('trips').delete().eq('id', trip.id);
      throw new InternalServerErrorException('Failed to create trip');
    }
    // Reflect the trigger's bump in the returned object so callers don't
    // refetch just to see a count of 1.
    trip.participantCount = (trip.participantCount ?? 0) + 1;

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
      visibility?: string;
      waypoints?: Array<{
        type: string;
        name: string;
        lat: number;
        lng: number;
        notes?: string;
        sortOrder: number;
        dayIndex?: number;
      }>;
    },
  ): Promise<Trip> {
    await this.verifyOrganiser(userId, tripId);

    // Snapshot current visibility for audit logging if it changes.
    let oldVisibility: string | undefined;
    if (input.visibility !== undefined) {
      const { data: existingVis } = await this.supabase
        .from('trips')
        .select('visibility')
        .eq('id', tripId)
        .single();
      oldVisibility = (existingVis?.visibility as string | undefined) ?? undefined;
    }

    const update: Record<string, unknown> = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.startDate !== undefined) update.start_date = input.startDate;
    if (input.endDate !== undefined) update.end_date = input.endDate;
    if (input.difficulty !== undefined) update.difficulty = input.difficulty;
    if (input.maxRiders !== undefined) update.max_riders = input.maxRiders;
    if (input.visibility !== undefined) update.visibility = input.visibility;

    if (
      input.visibility !== undefined &&
      oldVisibility !== undefined &&
      oldVisibility !== input.visibility
    ) {
      this.logger.warn(
        `Trip visibility changed: ${JSON.stringify({
          tripId,
          oldVisibility,
          newVisibility: input.visibility,
          organiserUserId: userId,
        })}`,
      );
    }

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

    const trip = mapRowToTrip(data as unknown as TripRow);

    // Replace waypoints if provided (delete existing + insert new)
    if (input.waypoints) {
      await this.supabase.from('trip_waypoints').delete().eq('trip_id', tripId);

      if (input.waypoints.length > 0) {
        const waypointRows = input.waypoints.map((wp) => ({
          trip_id: tripId,
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
          this.logger.error(`updateTrip waypoints failed: ${wpError.message} (${wpError.code})`);
          throw new InternalServerErrorException('Failed to update trip waypoints');
        }

        if (waypointData) {
          trip.waypoints = (waypointData as unknown as WaypointRow[]).map(mapRowToWaypoint);
        }
      } else {
        trip.waypoints = [];
      }
    }

    return trip;
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
      dayIndex?: number;
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
      dayIndex?: number;
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
    // Defense-in-depth: if a bike is provided, verify it belongs to the
    // caller before entering the RPC. RLS on motorcycles will also block a
    // cross-user reference, but failing fast here produces a cleaner error.
    if (bikeId) {
      const { data: bike, error: bikeError } = await this.supabase
        .from('motorcycles')
        .select('id')
        .eq('id', bikeId)
        .eq('user_id', userId)
        .single();
      if (bikeError || !bike) {
        throw new ForbiddenException('Bike does not belong to caller');
      }
    }

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
  // Trip Invites (privacy feature)
  // ==========================================

  async inviteToTrip(userId: string, tripId: string, invitedUserId: string): Promise<boolean> {
    // Only the organizer may invite
    await this.verifyOrganiser(userId, tripId);

    // H5: cap total invites per trip at max_riders * 3 to prevent a
    // single organiser from fan-out spamming invites.
    const { data: tripRow } = await this.supabase
      .from('trips')
      .select('max_riders')
      .eq('id', tripId)
      .single();
    const maxRiders = (tripRow?.max_riders as number | undefined) ?? 0;
    if (maxRiders > 0) {
      const { count: existingInvitesCount } = await this.supabase
        .from('trip_invites')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId);
      if ((existingInvitesCount ?? 0) >= maxRiders * 3) {
        throw new BadRequestException('Invite limit reached');
      }
    }

    const { error } = await this.supabase.from('trip_invites').insert({
      trip_id: tripId,
      invited_user_id: invitedUserId,
      invited_by_user_id: userId,
    });

    if (error) {
      if (error.code === '23505') {
        // Already invited — idempotent success
        return true;
      }
      this.logger.error(`inviteToTrip failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to send trip invite');
    }
    return true;
  }

  async respondToTripInvite(userId: string, inviteId: string, accept: boolean): Promise<boolean> {
    const { data: invite, error: fetchError } = await this.supabase
      .from('trip_invites')
      .select('trip_id, invited_user_id')
      .eq('id', inviteId)
      .eq('invited_user_id', userId)
      .single();

    if (fetchError || !invite) {
      throw new NotFoundException('Invite not found');
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .from('trip_invites')
      .update(accept ? { accepted_at: nowIso } : { declined_at: nowIso })
      .eq('id', inviteId);

    if (updateError) {
      this.logger.error(`respondToTripInvite failed: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to update invite');
    }

    // On accept, add them to trip_participants via the existing join_trip RPC
    if (accept) {
      const { error: joinError } = await this.supabase.rpc('join_trip', {
        p_trip_id: invite.trip_id,
        p_user_id: userId,
        p_status: 'going',
        p_bike_id: null,
      });
      if (joinError) {
        this.logger.warn(`Accepted invite but join_trip failed: ${joinError.message}`);
      }
    }
    return true;
  }

  async listTripInvites(
    userId: string,
    tripId: string,
  ): Promise<
    Array<{
      id: string;
      invitedUserId: string;
      invitedAt: string;
      acceptedAt?: string;
      declinedAt?: string;
    }>
  > {
    // Defense-in-depth: require the caller to be the organiser. RLS also
    // enforces this on trip_invites, but an explicit check produces a clean
    // 403 instead of an empty list when a non-organiser calls this.
    await this.verifyOrganiser(userId, tripId);

    // Organizer can list all invites on their trip; admins can see everything
    // via RLS (is_admin() bypass)
    const { data, error } = await this.supabase
      .from('trip_invites')
      .select('id, invited_user_id, created_at, accepted_at, declined_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`listTripInvites failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to list trip invites');
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      invitedUserId: row.invited_user_id as string,
      invitedAt: row.created_at as string,
      acceptedAt: (row.accepted_at as string) ?? undefined,
      declinedAt: (row.declined_at as string) ?? undefined,
    }));
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
