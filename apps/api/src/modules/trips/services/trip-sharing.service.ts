import { ResolveTripByTokenResponseSchema } from '@motovault/types/validators';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import { TripShareTokenError } from '../errors/trip-share-token.errors';
import type { SharedTrip } from '../models/shared-trip.model';
import { verifyOrganiser } from './trip-lifecycle.service';

@Injectable()
export class TripSharingService {
  private readonly logger = new Logger(TripSharingService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async resolveTripByShareToken(shareToken: string): Promise<SharedTrip> {
    const { data, error } = await this.supabase.rpc(
      'resolve_trip_by_token' as never,
      {
        p_token: shareToken,
      } as never,
    );

    if (error || !data) {
      throw new TripShareTokenError('NOT_FOUND');
    }

    const parsed = ResolveTripByTokenResponseSchema.safeParse(data);
    if (!parsed.success) {
      this.logger.error(
        `resolve_trip_by_token payload shape drifted: ${JSON.stringify(parsed.error.format())}`,
      );
      throw new TripShareTokenError('NOT_FOUND');
    }

    const { trip, waypoints, participants } = parsed.data;
    return {
      id: trip.id,
      title: trip.title,
      description: trip.description ?? null,
      status: trip.status,
      difficulty: trip.difficulty,
      startDate: trip.start_date,
      endDate: trip.end_date,
      maxRiders: trip.max_riders,
      participantCount: trip.participant_count,
      coverImageUrl: trip.cover_image_url ?? null,
      waypoints: waypoints.map((w) => ({
        id: w.id,
        sortOrder: w.sort_order,
        dayIndex: w.day_index ?? null,
        type: w.type,
        name: w.name,
        notes: w.notes ?? null,
        lat: w.lat,
        lng: w.lng,
      })),
      participants: participants.map((p) => ({
        anonId: p.anon_id,
        role: p.role,
        status: p.status,
        displayName: p.display_name,
        avatarUrl: p.avatar_url ?? null,
      })),
    };
  }

  async rotateTripShareToken(userId: string, tripId: string): Promise<string> {
    await verifyOrganiser(this.supabase, this.logger, userId, tripId);
    const { data, error } = await this.supabase.rpc(
      'rotate_trip_share_token' as never,
      {
        p_trip_id: tripId,
      } as never,
    );

    if (error || !data) {
      this.logger.error(`rotate_trip_share_token failed: ${error?.message}`);
      throw new InternalServerErrorException('Failed to rotate share token');
    }
    return data as unknown as string;
  }

  async inviteToTrip(userId: string, tripId: string, invitedUserId: string): Promise<boolean> {
    // Only the organizer may invite
    await verifyOrganiser(this.supabase, this.logger, userId, tripId);

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
    await verifyOrganiser(this.supabase, this.logger, userId, tripId);

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
}
