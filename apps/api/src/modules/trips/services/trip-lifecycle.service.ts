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
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { Trip, TripConnection, TripWaypoint } from '../models/trip.model';

/** Shape returned by trips + users join */
export interface TripRow {
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
  updated_at: string | null;
  organiser_user_id: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
    is_public: boolean | null;
  } | null;
  /** Present when the query uses {@link TRIP_DETAIL_SELECT} (or template listing). */
  is_template?: boolean;
  slug?: string | null;
  country_code?: string | null;
  region_code?: string | null;
  city?: string | null;
  polyline?: string | null;
  distance_m?: number | null;
  elevation_gain_m?: number | null;
  estimated_duration_minutes?: number | null;
  surface_type?: string | null;
  curvature_index?: number | null;
  view_count?: number;
  clone_count?: number;
  average_rating?: number | null;
  review_count?: number;
  is_featured?: boolean;
  is_motovault_pick?: boolean;
  published_at?: string | null;
  is_flagged?: boolean;
  day_count?: number | null;
  start_lat?: number | null;
  start_lng?: number | null;
}

/** Shape returned by trip_waypoints */
export interface WaypointRow {
  id: string;
  trip_id: string;
  sort_order: number;
  day_index: number;
  period_of_day: string | null;
  type: string;
  name: string;
  notes: string | null;
  lat: number;
  lng: number;
  created_at: string;
}

/** Shape returned by trip_participants + users join */
export interface ParticipantRow {
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

export const TRIP_SELECT =
  'id, title, description, start_date, end_date, difficulty, max_riders, participant_count, status, visibility, cover_image_url, created_at, updated_at, organiser_user_id, users:organiser_user_id(id, display_name, public_username, avatar_url, is_public)';

/** Base TRIP_SELECT plus template & editorial columns (used by trip detail + template feeds). */
export const TRIP_DETAIL_SELECT = `${TRIP_SELECT},
  is_template, slug, country_code, region_code, city, polyline,
  distance_m, elevation_gain_m, estimated_duration_minutes,
  surface_type, curvature_index, view_count, clone_count,
  average_rating, review_count, is_featured, is_motovault_pick,
  published_at, is_flagged, day_count, start_lat, start_lng`;

/**
 * Redact organiser PII fields when the organiser has is_public=false
 * and the caller is neither the organiser nor a participant.
 * displayName is preserved; publicUsername and avatarUrl are cleared.
 */
export function redactOrganiser(
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

export function mapRowToTrip(row: TripRow, callerUserId?: string, isParticipant = false): Trip {
  const organiser = {
    id: row.users?.id ?? row.organiser_user_id,
    displayName: row.users?.display_name ?? 'Rider',
    publicUsername: row.users?.public_username ?? undefined,
    avatarUrl: row.users?.avatar_url ?? undefined,
  };
  const isPublic = row.users?.is_public !== false;
  const base: Trip = {
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
    updatedAt: row.updated_at ?? undefined,
    organiser: redactOrganiser(organiser, isPublic, callerUserId, isParticipant),
    isTemplate: false,
    viewCount: 0,
    cloneCount: 0,
    reviewCount: 0,
    isFeatured: false,
    isMotovaultPick: false,
    isFlagged: false,
  };

  if (!('is_template' in row)) {
    return base;
  }

  return {
    ...base,
    isTemplate: row.is_template === true,
    slug: row.slug ?? undefined,
    countryCode: row.country_code ?? undefined,
    regionCode: row.region_code ?? undefined,
    city: row.city ?? undefined,
    polyline: row.polyline ?? undefined,
    distanceM: row.distance_m ?? undefined,
    elevationGainM: row.elevation_gain_m ?? undefined,
    estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
    surfaceType: row.surface_type ?? undefined,
    curvatureIndex: row.curvature_index ?? undefined,
    viewCount: row.view_count ?? 0,
    cloneCount: row.clone_count ?? 0,
    averageRating: row.average_rating ?? undefined,
    reviewCount: row.review_count ?? 0,
    isFeatured: row.is_featured ?? false,
    isMotovaultPick: row.is_motovault_pick ?? false,
    publishedAt: row.published_at ?? undefined,
    isFlagged: row.is_flagged ?? false,
    dayCount: row.day_count ?? undefined,
    startLat: row.start_lat ?? undefined,
    startLng: row.start_lng ?? undefined,
  };
}

export function mapRowToWaypoint(row: WaypointRow): TripWaypoint {
  // Column `period_of_day` is constrained by a DB CHECK to 'morning'|'afternoon'|
  // 'evening', so narrowing by cast is safe here. Anything else would surface
  // as a DB constraint error before it ever reached this mapper.
  return {
    id: row.id,
    tripId: row.trip_id,
    sortOrder: row.sort_order,
    dayIndex: row.day_index,
    periodOfDay: (row.period_of_day as TripWaypoint['periodOfDay']) ?? null,
    type: row.type,
    name: row.name,
    notes: row.notes ?? undefined,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
  };
}

/**
 * Verify that the given user is the organiser of the given trip.
 * Shared helper used by multiple trip sub-services.
 */
export async function verifyOrganiser(
  supabase: SupabaseClient,
  logger: Logger,
  userId: string,
  tripId: string,
): Promise<{ status: string }> {
  const { data: existing, error } = await supabase
    .from('trips')
    .select('organiser_user_id, status')
    .eq('id', tripId)
    .single();

  if (error || !existing) {
    if (error?.code === 'PGRST116') {
      throw new NotFoundException('Trip not found');
    }
    logger.error(`verifyOrganiser failed: ${error?.message}`);
    throw new InternalServerErrorException('Failed to verify trip');
  }

  if (existing.organiser_user_id !== userId) {
    throw new ForbiddenException('Only the organiser can modify this trip');
  }

  return { status: existing.status };
}

@Injectable()
export class TripLifecycleService {
  private readonly logger = new Logger(TripLifecycleService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

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

  /**
   * Discover “trips from riders” strip: real planned public trips only — not browseable
   * templates, not data-migration rows, not placeholder dates, and not organised by admin seed users.
   */
  async getDiscoverRiderTrips(first: number, after?: string): Promise<TripConnection> {
    const limit = Math.min(first, 50);
    const today = new Date().toISOString().slice(0, 10);

    const { data: adminRows, error: adminErr } = await this.supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin');
    if (adminErr) {
      this.logger.warn(`getDiscoverRiderTrips admin lookup: ${adminErr.message}`);
    }
    const adminIds = (adminRows ?? []).map((r: { id: string }) => r.id);

    let query = this.supabase
      .from('trips')
      .select(TRIP_SELECT)
      .eq('is_template', false)
      .eq('dates_pending', false)
      .is('migrated_from_discover_trip_id', null)
      .in('status', ['published', 'active'])
      .eq('visibility', 'public')
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit + 1);

    if (adminIds.length > 0) {
      query = query.not('organiser_user_id', 'in', `(${adminIds.join(',')})`);
    }

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      const [startDate, id] = decoded.split('|');
      if (startDate && id) {
        query = query.or(`start_date.gt.${startDate},and(start_date.eq.${startDate},id.gt.${id})`);
      } else if (startDate) {
        query = query.gt('start_date', startDate);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getDiscoverRiderTrips failed: ${error.message} (${error.code})`);
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
    this.logger.debug(`tripDetail: fetching trip=${tripId} caller=${callerUserId ?? 'anon'}`);

    const { data: tripData, error: tripError } = await this.supabase
      .from('trips')
      .select(TRIP_DETAIL_SELECT)
      .eq('id', tripId)
      .single();

    if (tripError || !tripData) {
      if (tripError?.code === 'PGRST116') {
        this.logger.warn(
          `tripDetail: trip=${tripId} not found for caller=${callerUserId ?? 'anon'} ` +
            '(RLS may be blocking — check visibility + participant status)',
        );
        throw new NotFoundException('Trip not found');
      }
      this.logger.error(
        `tripDetail: trip=${tripId} failed: ${tripError?.message} (${tripError?.code})`,
      );
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
        periodOfDay?: string;
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
        period_of_day: wp.periodOfDay ?? null,
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
        periodOfDay?: string;
      }>;
    },
  ): Promise<Trip> {
    await verifyOrganiser(this.supabase, this.logger, userId, tripId);

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

    // Cloned template rows use dates_pending + sentinel 1970-01-01. Saving real
    // dates must clear the flag or chk_trips_date_range fails.
    if (input.startDate !== undefined || input.endDate !== undefined) {
      const { data: curDates, error: curErr } = await this.supabase
        .from('trips')
        .select('start_date, end_date')
        .eq('id', tripId)
        .single();
      if (curErr) {
        this.logger.error(`updateTrip load current dates: ${curErr.message} (${curErr.code})`);
        throw new InternalServerErrorException('Failed to update trip');
      }
      const mergedStart = input.startDate ?? (curDates?.start_date as string);
      const mergedEnd = input.endDate ?? (curDates?.end_date as string);
      const SENTINEL = '1970-01-01';
      if (mergedStart === SENTINEL && mergedEnd === SENTINEL) {
        update.dates_pending = true;
      } else {
        update.dates_pending = false;
      }
    }
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
      if (error.code === '23514') {
        throw new BadRequestException(
          'Invalid trip dates. The end date must be on or after the start date.',
        );
      }
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
          period_of_day: wp.periodOfDay ?? null,
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
    await verifyOrganiser(this.supabase, this.logger, userId, tripId);

    const { error } = await this.supabase.from('trips').delete().eq('id', tripId);

    if (error) {
      this.logger.error(`deleteTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to delete trip');
    }

    return true;
  }

  async publishTrip(userId: string, tripId: string): Promise<Trip> {
    const existing = await verifyOrganiser(this.supabase, this.logger, userId, tripId);

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

  /**
   * Share a completed ride as a published template trip on Discover.
   * Copies ride polyline, distance, and elevation into a new `trips` row
   * with `is_template=true`, `status='published'`.
   */
  async shareRideAsTrip(
    userId: string,
    input: { rideId: string; name?: string; surfaceType?: string },
  ): Promise<Trip> {
    // 1. Fetch the ride (must be owned by user, completed, with polyline)
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id, user_id, route_polyline, distance_m, elevation_gain, elevation_loss, status')
      .eq('id', input.rideId)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.user_id !== userId) {
      throw new ForbiddenException('You can only share your own rides');
    }

    if (ride.status !== 'completed') {
      throw new BadRequestException('Only completed rides can be shared');
    }

    if (!ride.route_polyline) {
      throw new BadRequestException('Ride has no route data');
    }

    // 2. Check if already shared as a trip template
    const { data: existing } = await this.supabase
      .from('trips')
      .select('id')
      .eq('source_ride_id', input.rideId)
      .eq('is_template', true)
      .single();

    if (existing) {
      throw new BadRequestException('This ride is already shared on Discover');
    }

    // 3. Build the trip title
    const title = input.name || 'Shared Ride';
    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 4. Insert trip as a published template
    const { data: tripData, error: insertError } = await this.supabase
      .from('trips')
      .insert({
        organiser_user_id: userId,
        title,
        description: `Ride shared to Discover on ${now}`,
        start_date: now,
        end_date: now,
        difficulty: 'moderate',
        max_riders: 1,
        status: 'published',
        visibility: 'public',
        is_template: true,
        polyline: ride.route_polyline,
        distance_m: ride.distance_m ?? null,
        elevation_gain_m: ride.elevation_gain ?? null,
        surface_type: input.surfaceType ?? 'unknown',
        source_ride_id: input.rideId,
        published_at: new Date().toISOString(),
      })
      .select(TRIP_DETAIL_SELECT)
      .single();

    if (insertError || !tripData) {
      this.logger.error(`shareRideAsTrip insert failed: ${insertError?.message}`);
      throw new InternalServerErrorException('Failed to share ride as trip');
    }

    return mapRowToTrip(tripData as unknown as TripRow, userId);
  }
}
