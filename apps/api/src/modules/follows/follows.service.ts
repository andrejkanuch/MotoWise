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

/** Row shape for the follows table (not yet in database.types.ts) */
type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

import type { Follow } from './models/follow.model';
import type { FollowConnection } from './models/follow-connection.model';

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async follow(currentUserId: string, targetUserId: string): Promise<Follow> {
    this.logger.log(`follow: ${currentUserId} -> ${targetUserId}`);

    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Verify target user is public
    const { data: targetUser, error: userError } = await this.supabase
      .from('users')
      .select('id, is_public')
      .eq('id', targetUserId)
      .single();

    if (userError || !targetUser) {
      throw new BadRequestException('User not found');
    }

    if (!targetUser.is_public) {
      throw new ForbiddenException('Cannot follow a private profile');
    }

    const { data, error } = await this.supabase
      .from('follows')
      .insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      })
      .select()
      .single();

    if (error || !data) {
      // Unique constraint violation = already following
      if (error?.code === '23505') {
        throw new BadRequestException('Already following this user');
      }
      this.logger.error(`follow failed: ${error?.message} (${error?.code})`);
      throw new InternalServerErrorException('Failed to follow user');
    }

    return this.mapRow(data);
  }

  async unfollow(currentUserId: string, targetUserId: string): Promise<boolean> {
    this.logger.log(`unfollow: ${currentUserId} -> ${targetUserId}`);

    const { data, error } = await this.supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .select('follower_id')
      .single();

    if (error || !data) {
      this.logger.error(`unfollow failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Not following this user');
    }

    return true;
  }

  async getFollowers(
    currentUserId: string,
    userId: string,
    first: number,
    after?: string,
  ): Promise<FollowConnection> {
    this.logger.debug(`getFollowers: userId=${userId}, first=${first}, after=${after}`);

    await this.assertProfileVisible(currentUserId, userId);

    const limit = Math.min(first, 50);
    let query = this.supabase
      .from('follows')
      .select('*', { count: 'exact' })
      .eq('following_id', userId)
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

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`getFollowers failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch followers');
    }

    return this.buildConnection(data ?? [], limit, count ?? 0, !!after, 'follower_id');
  }

  async getFollowing(
    currentUserId: string,
    userId: string,
    first: number,
    after?: string,
  ): Promise<FollowConnection> {
    this.logger.debug(`getFollowing: userId=${userId}, first=${first}, after=${after}`);

    await this.assertProfileVisible(currentUserId, userId);

    const limit = Math.min(first, 50);
    let query = this.supabase
      .from('follows')
      .select('*', { count: 'exact' })
      .eq('follower_id', userId)
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

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`getFollowing failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch following');
    }

    return this.buildConnection(data ?? [], limit, count ?? 0, !!after, 'following_id');
  }

  private async assertProfileVisible(currentUserId: string, targetUserId: string): Promise<void> {
    if (currentUserId === targetUserId) return;

    const { data: targetUser, error } = await this.supabase
      .from('users')
      .select('id, is_public')
      .eq('id', targetUserId)
      .single();

    if (error || !targetUser) {
      throw new BadRequestException('User not found');
    }

    if (!targetUser.is_public) {
      throw new ForbiddenException('This profile is private');
    }
  }

  private async buildConnection(
    rows: FollowRow[],
    limit: number,
    totalCount: number,
    hasPreviousPage: boolean,
    enrichField: 'follower_id' | 'following_id',
  ): Promise<FollowConnection> {
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    // Enrich with user display info
    const userIds = sliced.map((r) => r[enrichField]);
    const userMap = await this.fetchUserDisplayInfo(userIds);

    const edges = sliced.map((row) => {
      const node = this.mapRow(row);
      const userInfo = userMap.get(row[enrichField]);
      if (userInfo) {
        node.displayName = userInfo.display_name ?? undefined;
        node.publicUsername = userInfo.public_username ?? undefined;
        node.avatarUrl = userInfo.avatar_url ?? undefined;
      }
      return {
        node,
        cursor: Buffer.from(node.createdAt).toString('base64'),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount,
    };
  }

  private async fetchUserDisplayInfo(
    userIds: string[],
  ): Promise<
    Map<
      string,
      { display_name: string | null; public_username: string | null; avatar_url: string | null }
    >
  > {
    if (userIds.length === 0) return new Map();

    const { data } = await this.supabase
      .from('users')
      .select('id, display_name, public_username, avatar_url')
      .in('id', userIds);

    const map = new Map<
      string,
      { display_name: string | null; public_username: string | null; avatar_url: string | null }
    >();
    for (const row of data ?? []) {
      map.set(row.id, row);
    }
    return map;
  }

  private mapRow(row: FollowRow): Follow {
    return {
      followerId: row.follower_id,
      followingId: row.following_id,
      createdAt: row.created_at,
    };
  }
}
