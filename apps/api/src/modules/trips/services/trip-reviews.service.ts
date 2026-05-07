import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';

/** DB row shape for trip_reviews */
interface ReviewRow {
  id: string;
  trip_id: string;
  user_id: string;
  rating: number;
  text: string | null;
  condition_tags: string[];
  bike_id: string | null;
  created_at: string;
  users: {
    id: string;
    display_name: string | null;
    public_username: string | null;
    avatar_url: string | null;
  } | null;
  motorcycles: {
    make: string;
    model: string;
    year: number;
    motorcycle_type: string | null;
  } | null;
}

/** Mapped review shape (camelCase) */
export interface TripReview {
  id: string;
  tripId: string;
  userId: string;
  rating: number;
  text: string | null;
  conditionTags: string[];
  bikeId: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    displayName: string;
    publicUsername?: string;
    avatarUrl?: string;
  };
  author?: {
    id: string;
    displayName: string;
    publicUsername?: string;
    avatarUrl?: string;
  };
  bike?: {
    make: string;
    model: string;
    year: number;
    type?: string;
  };
}

export interface TripReviewEdge {
  node: TripReview;
  cursor: string;
}

export interface TripReviewConnection {
  edges: TripReviewEdge[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

const REVIEW_SELECT = `
  id, trip_id, user_id, rating, text, condition_tags, bike_id, created_at,
  users:user_id(id, display_name, public_username, avatar_url),
  motorcycles:bike_id(make, model, year, motorcycle_type)
`.trim();

@Injectable()
export class TripReviewsService {
  private readonly logger = new Logger(TripReviewsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async getReviewsForTrip(
    tripId: string,
    first: number,
    after?: string,
  ): Promise<TripReviewConnection> {
    const limit = Math.min(first, 50);

    // Use admin client for public reads — the motorcycles join requires
    // bypassing owner-only RLS on the motorcycles table. Reviews on published
    // templates are intentionally public (trip_reviews_select policy).
    let query = this.supabaseAdmin
      .from('trip_reviews')
      .select(REVIEW_SELECT)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    // Cursor pagination: composite (created_at, id)
    if (after) {
      const decoded = this.decodeCursor(after);
      if (decoded) {
        query = query.or(
          `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`getReviewsForTrip failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch reviews');
    }

    const rows = (data ?? []) as unknown as ReviewRow[];
    const hasNextPage = rows.length > limit;
    const edges = rows.slice(0, limit).map((row) => ({
      node: this.mapRow(row),
      cursor: this.encodeCursor(row.created_at, row.id),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      },
    };
  }

  async createReview(
    userId: string,
    input: {
      tripId: string;
      rating: number;
      text?: string;
      conditionTags?: string[];
      bikeId?: string;
    },
  ): Promise<TripReview> {
    const { data, error } = await this.supabase
      .from('trip_reviews')
      .insert({
        trip_id: input.tripId,
        user_id: userId,
        rating: input.rating,
        text: input.text ?? null,
        condition_tags: input.conditionTags ?? [],
        bike_id: input.bikeId ?? null,
      })
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      this.logger.error(`createReview failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to create review');
    }

    return this.mapRow(data as unknown as ReviewRow);
  }

  async deleteReview(userId: string, reviewId: string): Promise<boolean> {
    // Defense-in-depth: user_id check alongside RLS
    const { data, error } = await this.supabase
      .from('trip_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !data) throw new NotFoundException('Review not found or not owned by you');
    return true;
  }

  // ==========================================
  // Helpers
  // ==========================================

  private mapRow(row: ReviewRow): TripReview {
    const author = row.users
      ? {
          id: row.users.id,
          displayName: row.users.display_name ?? 'Rider',
          publicUsername: row.users.public_username ?? undefined,
          avatarUrl: row.users.avatar_url ?? undefined,
        }
      : undefined;

    const bike = row.motorcycles
      ? {
          make: row.motorcycles.make,
          model: row.motorcycles.model,
          year: row.motorcycles.year,
          type: row.motorcycles.motorcycle_type ?? undefined,
        }
      : undefined;

    return {
      id: row.id,
      tripId: row.trip_id,
      userId: row.user_id,
      rating: row.rating,
      text: row.text,
      conditionTags: row.condition_tags ?? [],
      bikeId: row.bike_id,
      createdAt: row.created_at,
      reviewer: author,
      author,
      bike,
    };
  }

  private encodeCursor(createdAt: string, id: string): string {
    return Buffer.from(`${createdAt}|${id}`).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parts = decoded.split('|');
      if (parts.length !== 2) return null;
      const [createdAt, id] = parts;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt)) return null;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
      return { createdAt, id };
    } catch {
      return null;
    }
  }
}
