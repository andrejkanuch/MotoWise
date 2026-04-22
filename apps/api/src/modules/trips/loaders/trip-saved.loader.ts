import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';

/**
 * Request-scoped DataLoader for batching isSaved checks on trips.
 * Prevents N+1 when resolving isSaved on a list of trip templates.
 */
@Injectable({ scope: Scope.REQUEST })
export class TripSavedLoader {
  private loader: DataLoader<string, boolean> | null = null;
  private userId: string | null = null;
  private readonly logger = new Logger(TripSavedLoader.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  /** Initialize the loader with the authenticated user's ID */
  forUser(userId: string): this {
    if (this.userId !== userId || !this.loader) {
      this.userId = userId;
      this.loader = new DataLoader<string, boolean>(async (tripIds) => {
        const { data, error } = await this.supabase
          .from('trip_saves')
          .select('trip_id')
          .eq('user_id', userId)
          .in('trip_id', [...tripIds]);

        if (error) {
          this.logger.error(`TripSavedLoader batch failed: ${error.message}`);
          return tripIds.map(() => false);
        }

        const savedSet = new Set((data ?? []).map((row: { trip_id: string }) => row.trip_id));
        return tripIds.map((id) => savedSet.has(id));
      });
    }
    return this;
  }

  load(tripId: string): Promise<boolean> {
    if (!this.loader) {
      throw new Error('TripSavedLoader not initialized — call forUser() first');
    }
    return this.loader.load(tripId);
  }
}
