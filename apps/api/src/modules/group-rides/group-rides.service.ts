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
import type { GroupRide, GroupRideConnection } from './models/group-ride.model';

/** Shape returned by group_rides + users join */
interface GroupRideRow {
  id: string;
  title: string;
  description: string;
  date_time: string;
  meeting_point_lat: number;
  meeting_point_lng: number;
  meeting_point_name: string | null;
  route_id: string | null;
  route_description: string | null;
  difficulty: string;
  max_riders: number;
  participant_count: number;
  status: string;
  created_at: string;
  organiser_user_id: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

/** Shape returned by group_ride_participants + users join */
interface ParticipantRow {
  user_id: string;
  joined_at: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

const GROUP_RIDE_SELECT =
  'id, title, description, date_time, meeting_point_lat, meeting_point_lng, meeting_point_name, route_id, route_description, difficulty, max_riders, participant_count, status, created_at, organiser_user_id, users:organiser_user_id(id, display_name, public_username, avatar_url)';

function mapRowToGroupRide(row: GroupRideRow): GroupRide {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dateTime: row.date_time,
    meetingPointLat: row.meeting_point_lat,
    meetingPointLng: row.meeting_point_lng,
    meetingPointName: row.meeting_point_name ?? undefined,
    routeId: row.route_id ?? undefined,
    routeDescription: row.route_description ?? undefined,
    difficulty: row.difficulty,
    maxRiders: row.max_riders,
    participantCount: row.participant_count,
    status: row.status,
    createdAt: row.created_at,
    organiser: {
      id: row.users?.id ?? row.organiser_user_id,
      displayName: row.users?.display_name ?? 'Rider',
      publicUsername: row.users?.public_username ?? undefined,
      avatarUrl: row.users?.avatar_url ?? undefined,
    },
  };
}

@Injectable()
export class GroupRidesService {
  private readonly logger = new Logger(GroupRidesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  // ==========================================
  // Queries
  // ==========================================

  async getGroupRides(
    first: number,
    after?: string,
    _nearLat?: number,
    _nearLng?: number,
    _radiusKm?: number,
  ): Promise<GroupRideConnection> {
    const limit = Math.min(first, 50);

    let query = this.supabaseAdmin
      .from('group_rides')
      .select(GROUP_RIDE_SELECT)
      .in('status', ['published', 'full'])
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      if (Number.isNaN(Date.parse(decoded))) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.gt('date_time', decoded);
    }

    // Note: spatial filtering (nearLat/nearLng/radiusKm) would ideally use
    // a PostGIS RPC. For now we fetch and let the client handle proximity,
    // or a future RPC can be wired in here.

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getGroupRides failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch group rides');
    }

    const rows = (data ?? []) as unknown as GroupRideRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => {
      const node = mapRowToGroupRide(row);
      return {
        node,
        cursor: Buffer.from(row.date_time).toString('base64'),
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

  async getGroupRideDetail(groupRideId: string): Promise<GroupRide> {
    // Fetch ride
    const { data: rideData, error: rideError } = await this.supabaseAdmin
      .from('group_rides')
      .select(GROUP_RIDE_SELECT)
      .eq('id', groupRideId)
      .in('status', ['published', 'full', 'completed'])
      .single();

    if (rideError || !rideData) {
      if (rideError?.code === 'PGRST116') {
        throw new NotFoundException('Group ride not found');
      }
      this.logger.error(`getGroupRideDetail failed: ${rideError?.message} (${rideError?.code})`);
      throw new InternalServerErrorException('Failed to fetch group ride');
    }

    const row = rideData as unknown as GroupRideRow;
    const ride = mapRowToGroupRide(row);

    // Fetch participants
    const { data: participantData, error: participantError } = await this.supabaseAdmin
      .from('group_ride_participants')
      .select('user_id, joined_at, users:user_id(id, display_name, public_username, avatar_url)')
      .eq('group_ride_id', groupRideId)
      .order('joined_at', { ascending: true });

    if (participantError) {
      this.logger.error(
        `getGroupRideDetail participants failed: ${participantError.message} (${participantError.code})`,
      );
      // Non-fatal — return ride without participants
      return ride;
    }

    const participantRows = (participantData ?? []) as unknown as ParticipantRow[];

    ride.participants = participantRows.map((p) => ({
      id: p.users?.id ?? p.user_id,
      displayName: p.users?.display_name ?? 'Rider',
      publicUsername: p.users?.public_username ?? undefined,
      avatarUrl: p.users?.avatar_url ?? undefined,
      joinedAt: p.joined_at,
    }));

    return ride;
  }

  // ==========================================
  // Mutations
  // ==========================================

  async createGroupRide(
    userId: string,
    input: {
      title: string;
      description: string;
      dateTime: string;
      meetingPointLat: number;
      meetingPointLng: number;
      meetingPointName?: string;
      routeId?: string;
      routeDescription?: string;
      difficulty: string;
      maxRiders: number;
    },
  ): Promise<GroupRide> {
    // Double-check dateTime is future (Zod validates too, but belt + suspenders)
    if (new Date(input.dateTime).getTime() <= Date.now()) {
      throw new BadRequestException('dateTime must be in the future');
    }

    const { data, error } = await this.supabase
      .from('group_rides')
      .insert({
        organiser_user_id: userId,
        title: input.title,
        description: input.description,
        date_time: input.dateTime,
        meeting_point_lat: input.meetingPointLat,
        meeting_point_lng: input.meetingPointLng,
        meeting_point_name: input.meetingPointName ?? null,
        route_id: input.routeId ?? null,
        route_description: input.routeDescription ?? null,
        difficulty: input.difficulty,
        max_riders: input.maxRiders,
      })
      .select(GROUP_RIDE_SELECT)
      .single();

    if (error) {
      this.logger.error(`createGroupRide failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to create group ride');
    }

    const row = data as unknown as GroupRideRow;
    return mapRowToGroupRide(row);
  }

  async updateGroupRide(
    userId: string,
    groupRideId: string,
    input: {
      title?: string;
      description?: string;
      dateTime?: string;
      meetingPointLat?: number;
      meetingPointLng?: number;
      meetingPointName?: string;
      maxRiders?: number;
    },
  ): Promise<GroupRide> {
    // Verify organiser owns this ride
    const { data: existing, error: checkError } = await this.supabase
      .from('group_rides')
      .select('organiser_user_id')
      .eq('id', groupRideId)
      .single();

    if (checkError || !existing) {
      if (checkError?.code === 'PGRST116') {
        throw new NotFoundException('Group ride not found');
      }
      this.logger.error(`updateGroupRide check failed: ${checkError?.message}`);
      throw new InternalServerErrorException('Failed to verify group ride');
    }

    if (existing.organiser_user_id !== userId) {
      throw new ForbiddenException('Only the organiser can update this ride');
    }

    if (input.dateTime && new Date(input.dateTime).getTime() <= Date.now()) {
      throw new BadRequestException('dateTime must be in the future');
    }

    // Build update payload — only include provided fields
    const update: Record<string, unknown> = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.dateTime !== undefined) update.date_time = input.dateTime;
    if (input.meetingPointLat !== undefined) update.meeting_point_lat = input.meetingPointLat;
    if (input.meetingPointLng !== undefined) update.meeting_point_lng = input.meetingPointLng;
    if (input.meetingPointName !== undefined) update.meeting_point_name = input.meetingPointName;
    if (input.maxRiders !== undefined) update.max_riders = input.maxRiders;

    const { data, error } = await this.supabase
      .from('group_rides')
      .update(update)
      .eq('id', groupRideId)
      .select(GROUP_RIDE_SELECT)
      .single();

    if (error) {
      this.logger.error(`updateGroupRide failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to update group ride');
    }

    const row = data as unknown as GroupRideRow;
    return mapRowToGroupRide(row);
  }

  async cancelGroupRide(userId: string, groupRideId: string): Promise<boolean> {
    // Verify organiser owns this ride
    const { data: existing, error: checkError } = await this.supabase
      .from('group_rides')
      .select('organiser_user_id, status')
      .eq('id', groupRideId)
      .single();

    if (checkError || !existing) {
      if (checkError?.code === 'PGRST116') {
        throw new NotFoundException('Group ride not found');
      }
      this.logger.error(`cancelGroupRide check failed: ${checkError?.message}`);
      throw new InternalServerErrorException('Failed to verify group ride');
    }

    if (existing.organiser_user_id !== userId) {
      throw new ForbiddenException('Only the organiser can cancel this ride');
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Group ride is already cancelled');
    }

    const { error } = await this.supabase
      .from('group_rides')
      .update({ status: 'cancelled' })
      .eq('id', groupRideId);

    if (error) {
      this.logger.error(`cancelGroupRide failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to cancel group ride');
    }

    return true;
  }

  async joinGroupRide(userId: string, groupRideId: string): Promise<boolean> {
    // Use atomic RPC with row-level locking to prevent race conditions
    const { error } = await this.supabase.rpc('join_group_ride', {
      p_group_ride_id: groupRideId,
      p_user_id: userId,
    });

    if (error) {
      if (error.message.includes('Cannot join')) {
        throw new BadRequestException(error.message.replace('Cannot join: ', ''));
      }
      this.logger.error(`joinGroupRide failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to join group ride');
    }

    return true;
  }

  async leaveGroupRide(userId: string, groupRideId: string): Promise<boolean> {
    // Verify ride date is in the future
    const { data: ride, error: rideError } = await this.supabase
      .from('group_rides')
      .select('date_time')
      .eq('id', groupRideId)
      .single();

    if (rideError || !ride) {
      if (rideError?.code === 'PGRST116') {
        throw new NotFoundException('Group ride not found');
      }
      this.logger.error(`leaveGroupRide check failed: ${rideError?.message}`);
      throw new InternalServerErrorException('Failed to verify group ride');
    }

    if (new Date(ride.date_time).getTime() <= Date.now()) {
      throw new BadRequestException('Cannot leave a ride that has already started');
    }

    const { data, error } = await this.supabase
      .from('group_ride_participants')
      .delete()
      .eq('group_ride_id', groupRideId)
      .eq('user_id', userId)
      .select('user_id')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        throw new BadRequestException('You are not a participant in this ride');
      }
      this.logger.error(`leaveGroupRide delete failed: ${error?.message}`);
      throw new InternalServerErrorException('Failed to leave group ride');
    }

    return true;
  }
}
