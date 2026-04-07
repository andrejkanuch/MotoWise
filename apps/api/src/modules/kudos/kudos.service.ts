import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { KudosResult } from './models/kudos.model';
import type { KudosUser } from './models/kudos-user.model';

@Injectable()
export class KudosService {
  private readonly logger = new Logger(KudosService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async toggleKudos(rideId: string, userId: string): Promise<KudosResult> {
    this.logger.log(`toggleKudos: userId=${userId}, rideId=${rideId}`);

    // Verify ride is public and not deleted before allowing kudos
    const { data: ride, error: rideCheckError } = await this.supabase
      .from('rides')
      .select('is_public, deleted_at')
      .eq('id', rideId)
      .single();

    if (rideCheckError || !ride) {
      this.logger.error(
        `toggleKudos ride check failed: ${rideCheckError?.message} (${rideCheckError?.code})`,
      );
      throw new BadRequestException('Ride not found');
    }

    if (!ride.is_public || ride.deleted_at) {
      throw new ForbiddenException('Cannot give kudos to a private or deleted ride');
    }

    // Atomic toggle: try INSERT first, fall back to DELETE if already exists
    const { count, error: insertError } = await this.supabase
      .from('ride_kudos')
      .upsert(
        { ride_id: rideId, user_id: userId },
        { onConflict: 'ride_id,user_id', ignoreDuplicates: true, count: 'exact' },
      );

    if (insertError) {
      this.logger.error(`toggleKudos insert failed: ${insertError.message} (${insertError.code})`);
      throw new InternalServerErrorException('Failed to toggle kudos');
    }

    const inserted = (count ?? 0) > 0;

    if (!inserted) {
      // Row already existed — remove it (toggle off)
      const { error: deleteError } = await this.supabase
        .from('ride_kudos')
        .delete()
        .eq('ride_id', rideId)
        .eq('user_id', userId);

      if (deleteError) {
        this.logger.error(
          `toggleKudos delete failed: ${deleteError.message} (${deleteError.code})`,
        );
        throw new InternalServerErrorException('Failed to remove kudos');
      }
    }

    // Fetch current kudos_count from rides table (updated by DB trigger)
    const { data: rideData, error: rideError } = await this.supabase
      .from('rides')
      .select('kudos_count')
      .eq('id', rideId)
      .single();

    if (rideError || !rideData) {
      this.logger.error(
        `toggleKudos fetch count failed: ${rideError?.message} (${rideError?.code})`,
      );
      throw new BadRequestException('Ride not found');
    }

    return {
      hasKudos: inserted,
      kudosCount: (rideData.kudos_count as number) ?? 0,
    };
  }

  async getKudosList(
    rideId: string,
    first: number,
    after?: string,
  ): Promise<{ users: KudosUser[]; hasNextPage: boolean }> {
    this.logger.debug(`getKudosList: rideId=${rideId}, first=${first}, after=${after}`);

    const limit = Math.min(first, 50);
    let query = this.supabase
      .from('ride_kudos')
      .select('user_id, created_at, users:user_id(id, display_name, avatar_url, public_username)')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      const ts = Date.parse(decoded);
      if (Number.isNaN(ts)) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('created_at', decoded);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getKudosList failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch kudos list');
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const users: KudosUser[] = sliced.map((row) => {
      const user = row.users as unknown as Record<string, unknown> | null;
      return {
        id: (user?.id as string) ?? (row.user_id as string),
        displayName: (user?.display_name as string) ?? undefined,
        avatarUrl: (user?.avatar_url as string) ?? undefined,
        publicUsername: (user?.public_username as string) ?? undefined,
      };
    });

    return { users, hasNextPage };
  }
}
