import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import DataLoader from 'dataloader';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { TripReview } from '../models/trip.model';

/** DB row shape for trip_reviews (batch query) */
interface ReviewRow {
  id: string;
  trip_id: string;
  user_id: string;
  rating: number;
  text: string | null;
  condition_tags: string[];
  bike_id: string | null;
  created_at: string;
}

/**
 * Request-scoped DataLoader for batching trip review fetches.
 * Prevents N+1 when resolving reviews on a list of trip templates.
 */
@Injectable({ scope: Scope.REQUEST })
export class TripReviewsLoader {
  private readonly loader: DataLoader<string, TripReview[]>;
  private readonly logger = new Logger(TripReviewsLoader.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {
    this.loader = new DataLoader<string, TripReview[]>(async (tripIds) => {
      const { data, error } = await this.supabase
        .from('trip_reviews')
        .select('id, trip_id, user_id, rating, text, condition_tags, bike_id, created_at')
        .in('trip_id', [...tripIds])
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(`TripReviewsLoader batch failed: ${error.message}`);
        return tripIds.map(() => []);
      }

      const rows = (data ?? []) as unknown as ReviewRow[];

      // Group reviews by trip_id
      const map = new Map<string, TripReview[]>();
      for (const row of rows) {
        const review: TripReview = {
          id: row.id,
          tripId: row.trip_id,
          userId: row.user_id,
          rating: row.rating,
          text: row.text ?? undefined,
          conditionTags: row.condition_tags ?? [],
          bikeId: row.bike_id ?? undefined,
          createdAt: row.created_at,
        };
        const existing = map.get(row.trip_id);
        if (existing) {
          existing.push(review);
        } else {
          map.set(row.trip_id, [review]);
        }
      }

      return tripIds.map((id) => map.get(id) ?? []);
    });
  }

  load(tripId: string): Promise<TripReview[]> {
    return this.loader.load(tripId);
  }
}
