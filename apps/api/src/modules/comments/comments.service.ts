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
import { decodeCursor, encodeCursor } from '../../common/pagination/connection';
import { PG_ERROR, type UnwrapContext, unwrap } from '../../common/supabase/unwrap';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Comment, CommentConnection } from './models/comment.model';

/** Row shape from comments + users join */
interface CommentRow {
  id: string;
  text: string;
  created_at: string;
  flagged_count: number;
  parent_comment_id: string | null;
  user_id: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
}

const CREATE_COMMENT_FAILED = 'Failed to create comment';

/**
 * createComment insert errors the rider caused, mapped to a 4xx so they reach the
 * client as FORBIDDEN / NOT_FOUND instead of an opaque 500 (and stay out of Sentry,
 * which only captures 5xx).
 *
 * CHECK_VIOLATION (23514) is deliberately absent: CreateCommentInputSchema already
 * enforces exactly one target and the 1-500 text length, so a CHECK failure means the
 * API and the schema disagree. That is a server fault and must keep paging — it is
 * how comments_single_target ignoring trip_id surfaced (00202, MOTO-VAULT-NODE-NESTJS-W).
 */
const CREATE_COMMENT_CLIENT_ERRORS: Readonly<
  Record<string, { error: UnwrapContext<unknown>['error']; message: string }>
> = {
  // comments_insert RLS: the ride is not public, the route/group ride is not
  // published, or the trip is not one the caller can see.
  [PG_ERROR.INSUFFICIENT_PRIVILEGE]: {
    error: ForbiddenException,
    message: 'You cannot comment on this',
  },
  // The target or parent comment was deleted between the client loading it and posting.
  [PG_ERROR.FOREIGN_KEY_VIOLATION]: {
    error: NotFoundException,
    message: 'The item you are commenting on no longer exists',
  },
};

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async getComments(
    targetField: 'ride_id' | 'route_id' | 'group_ride_id' | 'trip_id',
    targetId: string,
    first: number,
    after?: string,
  ): Promise<CommentConnection> {
    const limit = Math.min(first, 50);

    // Count total top-level comments
    const { count: totalCount, error: countError } = await this.supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq(targetField, targetId)
      .is('parent_comment_id', null)
      .lt('flagged_count', 3);

    if (countError) {
      this.logger.error(`getComments count failed: ${countError.message}`);
      throw new InternalServerErrorException('Failed to count comments');
    }

    // Fetch top-level comments
    let query = this.supabase
      .from('comments')
      .select(
        'id, text, created_at, flagged_count, parent_comment_id, user_id, users:user_id(id, display_name, public_username, avatar_url)',
      )
      .eq(targetField, targetId)
      .is('parent_comment_id', null)
      .lt('flagged_count', 3)
      .order('created_at', { ascending: true })
      .limit(limit + 1);

    if (after) {
      const decoded = decodeCursor(after);
      if (!decoded) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.gt('created_at', decoded[0]);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`getComments failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch comments');
    }

    const rows = (data ?? []) as unknown as CommentRow[];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    // Fetch replies for all top-level comments in one query
    const parentIds = sliced.map((r) => r.id);
    let replies: CommentRow[] = [];

    if (parentIds.length > 0) {
      const { data: replyData, error: replyError } = await this.supabase
        .from('comments')
        .select(
          'id, text, created_at, flagged_count, parent_comment_id, user_id, users:user_id(id, display_name, public_username, avatar_url)',
        )
        .in('parent_comment_id', parentIds)
        .lt('flagged_count', 3)
        .order('created_at', { ascending: true });

      if (replyError) {
        this.logger.error(`getComments replies failed: ${replyError.message}`);
      } else {
        replies = (replyData ?? []) as unknown as CommentRow[];
      }
    }

    // Group replies by parent
    const repliesByParent = new Map<string, CommentRow[]>();
    for (const reply of replies) {
      if (!reply.parent_comment_id) continue;
      const existing = repliesByParent.get(reply.parent_comment_id) ?? [];
      existing.push(reply);
      repliesByParent.set(reply.parent_comment_id, existing);
    }

    const comments: Comment[] = sliced.map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      flaggedCount: row.flagged_count,
      parentCommentId: row.parent_comment_id ?? undefined,
      author: {
        id: row.users?.id ?? row.user_id,
        displayName: row.users?.display_name ?? 'Rider',
        publicUsername: row.users?.public_username ?? undefined,
        avatarUrl: row.users?.avatar_url ?? undefined,
      },
      replies: (repliesByParent.get(row.id) ?? []).map((r) => ({
        id: r.id,
        text: r.text,
        createdAt: r.created_at,
        flaggedCount: r.flagged_count,
        parentCommentId: r.parent_comment_id ?? undefined,
        author: {
          id: r.users?.id ?? r.user_id,
          displayName: r.users?.display_name ?? 'Rider',
          publicUsername: r.users?.public_username ?? undefined,
          avatarUrl: r.users?.avatar_url ?? undefined,
        },
      })),
    }));

    const lastComment = sliced[sliced.length - 1];
    const endCursor = lastComment ? encodeCursor(lastComment.created_at) : undefined;

    return {
      comments,
      hasNextPage,
      endCursor,
      totalCount: totalCount ?? 0,
    };
  }

  async createComment(
    userId: string,
    input: {
      rideId?: string;
      routeId?: string;
      groupRideId?: string;
      tripId?: string;
      parentCommentId?: string;
      text: string;
    },
  ): Promise<Comment> {
    // Enforce one-level nesting: if parentCommentId is set, verify parent has no parent
    if (input.parentCommentId) {
      const { data: parent, error: parentError } = await this.supabase
        .from('comments')
        .select('id, parent_comment_id')
        .eq('id', input.parentCommentId)
        .single();

      if (parentError || !parent) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parent.parent_comment_id) {
        throw new BadRequestException(
          'Cannot reply to a reply — only one level of nesting is allowed',
        );
      }
    }

    const { data, error } = await this.supabase
      .from('comments')
      .insert({
        user_id: userId,
        ride_id: input.rideId ?? null,
        route_id: input.routeId ?? null,
        group_ride_id: input.groupRideId ?? null,
        trip_id: input.tripId ?? null,
        parent_comment_id: input.parentCommentId ?? null,
        text: input.text,
      })
      .select(
        'id, text, created_at, flagged_count, parent_comment_id, user_id, users:user_id(id, display_name, public_username, avatar_url)',
      )
      .single();

    const clientError = error ? CREATE_COMMENT_CLIENT_ERRORS[error.code] : undefined;
    const row = unwrap(
      { data, error },
      {
        logger: this.logger,
        op: 'createComment',
        message: clientError?.message ?? CREATE_COMMENT_FAILED,
        error: clientError?.error,
      },
    ) as unknown as CommentRow;

    return {
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      flaggedCount: row.flagged_count,
      parentCommentId: row.parent_comment_id ?? undefined,
      author: {
        id: row.users?.id ?? row.user_id,
        displayName: row.users?.display_name ?? 'Rider',
        publicUsername: row.users?.public_username ?? undefined,
        avatarUrl: row.users?.avatar_url ?? undefined,
      },
    };
  }

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !data) {
      if (error?.code === PG_ERROR.NOT_FOUND) {
        throw new ForbiddenException('You can only delete your own comments');
      }
      this.logger.error(`deleteComment failed: ${error?.message}`);
      throw new InternalServerErrorException('Failed to delete comment');
    }

    return true;
  }

  async flagComment(commentId: string): Promise<boolean> {
    const { error } = await this.supabase.rpc('flag_comment', {
      comment_uuid: commentId,
    });

    if (error) {
      this.logger.error(`flagComment failed: ${error.message} (${error.code})`);
      if (error.message.includes('Comment not found')) {
        throw new NotFoundException('Comment not found');
      }
      throw new InternalServerErrorException('Failed to flag comment');
    }

    return true;
  }
}
