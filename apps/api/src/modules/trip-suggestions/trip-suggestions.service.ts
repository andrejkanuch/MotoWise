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

interface SuggestionRow {
  id: string;
  trip_id: string;
  author_user_id: string;
  kind: string;
  name: string;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  day_index: number | null;
  period_of_day: string | null;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  decided_note: string | null;
  waypoint_id: string | null;
  created_at: string;
  users: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    public_username: string | null;
  } | null;
}

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

  async list(userId: string, tripId: string): Promise<TripSuggestion[]> {
    this.logger.debug(`list suggestions userId=${userId} tripId=${tripId}`);
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

    return (data ?? []).map((row) => this.mapRow(row as unknown as SuggestionRow));
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

    return this.mapRow(data as unknown as SuggestionRow);
  }

  async respond(
    userId: string,
    input: RespondToTripSuggestionInput,
  ): Promise<TripSuggestion> {
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

    const existingRow = existing as unknown as SuggestionRow;

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
        throw new ForbiddenException('Only the organiser, co-planners, or the author can change this');
      }
      this.logger.error(`respond failed: ${error?.message} (${error?.code})`);
      throw new InternalServerErrorException('Failed to update suggestion');
    }

    return this.mapRow(data as unknown as SuggestionRow);
  }

  async setParticipantRole(userId: string, input: SetParticipantRoleInput): Promise<boolean> {
    // Only the trip organiser can promote/demote co_planners.
    const { data: trip, error: tripErr } = await this.supabase
      .from('trips')
      .select('id, organiser_user_id')
      .eq('id', input.tripId)
      .single();
    if (tripErr || !trip) throw new NotFoundException('Trip not found');
    if (trip.organiser_user_id !== userId) {
      throw new ForbiddenException('Only the organiser can change roles');
    }
    if (!['co_planner', 'rider'].includes(input.role)) {
      throw new BadRequestException('Role must be co_planner or rider');
    }

    const { error } = await this.supabase
      .from('trip_participants')
      .update({ role: input.role })
      .eq('trip_id', input.tripId)
      .eq('user_id', input.userId);

    if (error) {
      this.logger.error(`setParticipantRole failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to update role');
    }

    return true;
  }

  /** Insert a new trip_waypoint at the end of the requested day. */
  private async materialiseWaypoint(sug: SuggestionRow): Promise<string> {
    // Place at the end of the existing sort order for this day (fallback day 0).
    const dayIndex = sug.day_index ?? 0;
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

    const nextOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

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

    if (insertErr || !inserted) {
      if (insertErr?.code === '42501') {
        throw new ForbiddenException('You must be an organiser or co-planner to accept');
      }
      this.logger.error(`materialise insert failed: ${insertErr?.message} (${insertErr?.code})`);
      throw new InternalServerErrorException('Failed to accept suggestion');
    }

    return inserted.id;
  }

  private mapRow(row: SuggestionRow): TripSuggestion {
    const author = row.users;
    return {
      id: row.id,
      tripId: row.trip_id,
      kind: row.kind,
      name: row.name,
      notes: row.notes ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
      dayIndex: row.day_index ?? undefined,
      periodOfDay: row.period_of_day ?? undefined,
      status: row.status,
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
