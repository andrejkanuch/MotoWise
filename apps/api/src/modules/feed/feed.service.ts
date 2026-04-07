import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { FeedRideConnection } from './models/feed-connection.model';
import type { FeedBike, FeedRide, FeedRider } from './models/feed-ride.model';

/** Local row interface matching the select columns from the feed query */
interface FeedRideRow {
  id: string;
  name: string | null;
  distance_m: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  started_at: string;
  ended_at: string | null;
  ai_summary: string | null;
  kudos_count: number | null;
  route_thumbnail_uri: string | null;
  user_id: string;
  motorcycle_id: string | null;
  users: { display_name: string; avatar_url: string | null; public_username: string } | undefined;
  motorcycles: {
    make: string;
    model: string;
    year: number;
    nickname: string | null;
  } | null;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async getRideFeed(userId: string, first: number, after?: string): Promise<FeedRideConnection> {
    this.logger.debug(`getRideFeed: userId=${userId}, first=${first}, after=${after}`);

    const limit = Math.min(first, 50);

    // Step 1: Get IDs of users the current user follows
    const { data: followRows, error: followError } = await this.supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (followError) {
      this.logger.error(`getRideFeed follows lookup failed: ${followError.message}`);
      throw new InternalServerErrorException('Failed to fetch feed');
    }

    const followingIds = (followRows ?? []).map((r) => r.following_id as string);

    if (followingIds.length === 0) {
      return {
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: !!after,
          startCursor: undefined,
          endCursor: undefined,
        },
      };
    }

    // Step 2: Single query — rides with embedded user + motorcycle joins
    let query = this.supabase
      .from('rides')
      .select(
        'id, name, distance_m, elevation_gain, elevation_loss, started_at, ended_at, ai_summary, kudos_count, route_thumbnail_uri, user_id, motorcycle_id, users!inner(display_name, avatar_url, public_username), motorcycles(make, model, year, nickname)',
      )
      .in('user_id', followingIds)
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(limit + 1);

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      const ts = Date.parse(decoded);
      if (Number.isNaN(ts)) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('started_at', decoded);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getRideFeed query failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch feed');
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    // Step 3: Batch-check kudos existence for all returned ride IDs
    const rideIds = sliced.map((r) => r.id as string);
    let kudosSet = new Set<string>();

    if (rideIds.length > 0) {
      const { data: kudosRows, error: kudosError } = await this.supabase
        .from('ride_kudos')
        .select('ride_id')
        .eq('user_id', userId)
        .in('ride_id', rideIds);

      if (kudosError) {
        this.logger.warn(`getRideFeed kudos check failed: ${kudosError.message}`);
        // Non-fatal — feed still works, hasKudos will be false
      } else {
        kudosSet = new Set((kudosRows ?? []).map((r) => r.ride_id as string));
      }
    }

    // Step 4: Map rows to FeedRide
    const edges = sliced.map((row) => {
      const node = this.mapFeedRow(row as unknown as FeedRideRow, kudosSet);
      return {
        node,
        cursor: Buffer.from(node.startedAt).toString('base64'),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
    };
  }

  private mapFeedRow(row: FeedRideRow, kudosSet: Set<string>): FeedRide {
    const rider: FeedRider = {
      displayName: row.users?.display_name ?? 'Rider',
      avatarUrl: row.users?.avatar_url ?? undefined,
      publicUsername: row.users?.public_username ?? '',
    };

    const bike: FeedBike | undefined = row.motorcycles
      ? {
          make: row.motorcycles.make,
          model: row.motorcycles.model,
          year: row.motorcycles.year,
          nickname: row.motorcycles.nickname ?? undefined,
        }
      : undefined;

    return {
      id: row.id,
      name: row.name ?? undefined,
      distanceM: row.distance_m ?? undefined,
      elevationGain: row.elevation_gain ?? undefined,
      elevationLoss: row.elevation_loss ?? undefined,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      aiSummary: row.ai_summary ?? undefined,
      kudosCount: row.kudos_count ?? 0,
      hasKudos: kudosSet.has(row.id),
      routeThumbnailUri: row.route_thumbnail_uri ?? undefined,
      rider,
      bike,
    };
  }
}
