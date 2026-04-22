import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';

@Injectable()
export class TripParticipantsService {
  private readonly logger = new Logger(TripParticipantsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

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
}
