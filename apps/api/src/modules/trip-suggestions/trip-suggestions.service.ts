import type { Tables } from '@motovault/types/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type {
  CreateTripSuggestionInput,
  RespondToTripSuggestionInput,
  SetParticipantRoleInput,
} from './dto/trip-suggestion.inputs';
import type { TripSuggestion } from './models/trip-suggestion.model';

/**
 * Service for P5.1 — async waypoint suggestions + participant roles.
 *
 * The RLS policies on trip_suggestions do the heavy lifting for access
 * control; this service adds the extra business rules (accept materialises a
 * real trip_waypoint row, rejections freeze the suggestion, etc.) and
 * normalises snake_case → camelCase for the GraphQL layer.
 */

type SuggestionRow = Tables<'trip_suggestions'>;
type AuthorPick = Pick<Tables<'users'>, 'id' | 'display_name' | 'avatar_url' | 'public_username'>;

/**
 * Shape returned when we embed the author join off `author_user_id`.
 *
 * Supabase's runtime returns `users` as a single object (the FK is 1-1 against
 * public.users), but its select-string type parser defaults to an array when
 * the client is not parameterised with `Database`. We narrow with a single
 * `as unknown as` at each `.select(SELECT)` call site — same pattern used in
 * users.service.ts. The fix is to thread `Database` through the supabase-user
 * provider, which is a cross-module change left for a separate sweep.
 */
type SuggestionWithAuthor = SuggestionRow & { users: AuthorPick | null };

const MATERIALISE_RETRY_LIMIT = 3;

const SELECT = `
  id, trip_id, author_user_id, kind, name, notes, lat, lng, day_index,
  period_of_day, status, decided_by, decided_at, decided_note, waypoint_id,
  created_at,
  users:author_user_id (
    id, display_name, avatar_url, public_username
  )
`;

@Injectable()
export class TripSuggestionsService {
  private readonly logger = new Logger(TripSuggestionsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async list(tripId: string): Promise<TripSuggestion[]> {
    const { data, error } = await this.supabase
      .from('trip_suggestions')
      .select(SELECT)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      this.logger.error(`list failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to load suggestions');
    }

    const rows = (data ?? []) as unknown as SuggestionWithAuthor[];
    return rows.map((row) => this.mapRow(row));
  }

  async create(userId: string, input: CreateTripSuggestionInput): Promise<TripSuggestion> {
    this.logger.debug(`create suggestion userId=${userId} tripId=${input.tripId}`);

    if (input.kind === 'waypoint' && (input.lat == null || input.lng == null)) {
      throw new BadRequestException('Waypoint suggestions require coordinates');
    }

    const { data, error } = await this.supabase
      .from('trip_suggestions')
      .insert({
        trip_id: input.tripId,
        author_user_id: userId,
        kind: input.kind,
        name: input.name,
        notes: input.notes ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        day_index: input.dayIndex ?? null,
        period_of_day: input.periodOfDay ?? null,
      })
      .select(SELECT)
      .single();

    if (error || !data) {
      // RLS rejection surfaces here as PGRST or 42501 — map to Forbidden.
      if (error?.code === '42501') {
        throw new ForbiddenException('You must be a participant to propose changes');
      }
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new InternalServerErrorException('Failed to create suggestion');
    }

    return this.mapRow(data as unknown as SuggestionWithAuthor);
  }

  async respond(userId: string, input: RespondToTripSuggestionInput): Promise<TripSuggestion> {
    const { suggestionId, decision, note } = input;
    if (!['accepted', 'rejected', 'withdrawn'].includes(decision)) {
      throw new BadRequestException('Invalid decision');
    }

    const { data: existing, error: loadErr } = await this.supabase
      .from('trip_suggestions')
      .select(SELECT)
      .eq('id', suggestionId)
      .single();

    if (loadErr || !existing) {
      throw new NotFoundException('Suggestion not found');
    }

    const existingRow = existing as unknown as SuggestionWithAuthor;

    if (existingRow.status !== 'pending') {
      throw new BadRequestException('Suggestion already decided');
    }

    // Accepting a waypoint suggestion materialises an actual trip_waypoint
    // row and links it back via waypoint_id so clients can drill through.
    let waypointId: string | null = null;
    if (decision === 'accepted' && existingRow.kind === 'waypoint') {
      waypointId = await this.materialiseWaypoint(existingRow);
    }

    const { data, error } = await this.supabase
      .from('trip_suggestions')
      .update({
        status: decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decided_note: note ?? null,
        waypoint_id: waypointId ?? existingRow.waypoint_id,
      })
      .eq('id', suggestionId)
      .select(SELECT)
      .single();

    if (error || !data) {
      if (error?.code === '42501') {
        throw new ForbiddenException(
          'Only the organiser, co-planners, or the author can change this',
        );
      }
      this.logger.error(`respond failed: ${error?.message} (${error?.code})`);
      throw new InternalServerErrorException('Failed to update suggestion');
    }

    return this.mapRow(data as unknown as SuggestionWithAuthor);
  }

  async setParticipantRole(userId: string, input: SetParticipantRoleInput): Promise<boolean> {
    // Only the trip organiser can promote/demote co_planners.
    const { data: trip, error: tripErr } = await this.supabase
      .from('trips')
      .select('id, organiser_user_id')
      .eq('id', input.tripId)
      .single();
    if (tripErr || !trip) throw new NotFoundException('Trip not found');

    const tripRow = trip as Pick<Tables<'trips'>, 'id' | 'organiser_user_id'>;

    if (tripRow.organiser_user_id !== userId) {
      throw new ForbiddenException('Only the organiser can change roles');
    }
    if (!['co_planner', 'rider'].includes(input.role)) {
      throw new BadRequestException('Role must be co_planner or rider');
    }
    // Protect the organiser's own participant row from being silently demoted.
    if (input.userId === tripRow.organiser_user_id) {
      throw new BadRequestException('Cannot change role of trip organiser');
    }

    // Select back so we can distinguish "updated nothing" (stranger not on this
    // trip, or RLS blocked it) from a real success.
    const { data: updated, error } = await this.supabase
      .from('trip_participants')
      .update({ role: input.role })
      .eq('trip_id', input.tripId)
      .eq('user_id', input.userId)
      .select('trip_id, user_id');

    if (error) {
      this.logger.error(`setParticipantRole failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to update role');
    }
    if (!updated || updated.length === 0) {
      throw new NotFoundException('Participant not found on this trip');
    }

    return true;
  }

  /**
   * Insert a new trip_waypoint at the end of the requested day.
   *
   * 00107 adds a unique index on (trip_id, day_index, sort_order) so two
   * co-planners accepting suggestions at the same time can't silently grab the
   * same slot. We retry a bounded number of times on 23505 and bail with a
   * clean Conflict so the client can re-fetch + ask the user to try again.
   */
  private async materialiseWaypoint(sug: SuggestionRow): Promise<string> {
    const dayIndex = sug.day_index ?? 0;

    for (let attempt = 0; attempt < MATERIALISE_RETRY_LIMIT; attempt++) {
      const { data: siblings, error: siblingsErr } = await this.supabase
        .from('trip_waypoints')
        .select('sort_order')
        .eq('trip_id', sug.trip_id)
        .eq('day_index', dayIndex)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (siblingsErr) {
        this.logger.error(`materialise load failed: ${siblingsErr.message}`);
        throw new InternalServerErrorException('Failed to accept suggestion');
      }

      const topRow = siblings?.[0] as Pick<Tables<'trip_waypoints'>, 'sort_order'> | undefined;
      const nextOrder = (topRow?.sort_order ?? -1) + 1;

      const { data: inserted, error: insertErr } = await this.supabase
        .from('trip_waypoints')
        .insert({
          trip_id: sug.trip_id,
          type: 'stop',
          name: sug.name,
          notes: sug.notes,
          lat: sug.lat,
          lng: sug.lng,
          day_index: dayIndex,
          sort_order: nextOrder,
          period_of_day: sug.period_of_day,
        })
        .select('id')
        .single();

      if (!insertErr && inserted) {
        return (inserted as Pick<Tables<'trip_waypoints'>, 'id'>).id;
      }

      // 23505 = unique_violation — another co-planner grabbed this slot. Retry.
      if (insertErr?.code === '23505') {
        this.logger.debug(
          `materialise race on (${sug.trip_id}, ${dayIndex}, ${nextOrder}), attempt ${attempt + 1}`,
        );
        continue;
      }

      if (insertErr?.code === '42501') {
        throw new ForbiddenException('You must be an organiser or co-planner to accept');
      }
      this.logger.error(`materialise insert failed: ${insertErr?.message} (${insertErr?.code})`);
      throw new InternalServerErrorException('Failed to accept suggestion');
    }

    throw new ConflictException('Could not allocate waypoint sort order after retries — try again');
  }

  private mapRow(row: SuggestionWithAuthor): TripSuggestion {
    const author = row.users;
    // DB CHECK constraints narrow `kind`, `status`, and `period_of_day` to the
    // unions declared in @motovault/types, so these casts are safe.
    return {
      id: row.id,
      tripId: row.trip_id ?? '',
      kind: row.kind as TripSuggestion['kind'],
      name: row.name,
      notes: row.notes ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
      dayIndex: row.day_index ?? undefined,
      periodOfDay: (row.period_of_day as TripSuggestion['periodOfDay']) ?? undefined,
      status: row.status as TripSuggestion['status'],
      decidedBy: row.decided_by ?? undefined,
      decidedAt: row.decided_at ?? undefined,
      decidedNote: row.decided_note ?? undefined,
      waypointId: row.waypoint_id ?? undefined,
      createdAt: row.created_at,
      author: {
        id: author?.id ?? row.author_user_id,
        displayName: author?.display_name ?? 'Unknown rider',
        avatarUrl: author?.avatar_url ?? undefined,
        publicUsername: author?.public_username ?? undefined,
      },
    };
  }
}
