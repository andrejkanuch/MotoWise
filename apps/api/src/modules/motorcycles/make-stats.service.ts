import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { MakeStats } from './models/make-stats.model';

interface MakeStatsRow {
  make: string;
  riders: number;
  distinct_models: number;
  total_bikes: number;
}

/**
 * Fleet-wide make aggregates. Lives in its own SINGLETON service (admin client only)
 * so the TTL cache actually persists: MotorcyclesService injects the request-scoped
 * SUPABASE_USER client, which made the whole service request-scoped and reset this
 * cache on every request (audit H16). The `get_make_stats` RPC is a public aggregate
 * with no user-scoped RLS.
 */
@Injectable()
export class MakeStatsService {
  private readonly logger = new Logger(MakeStatsService.name);
  private cache: { data: MakeStats[]; expiresAt: number } | null = null;
  private static readonly TTL_MS = 900_000; // 15 minutes

  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  async getMakeStats(): Promise<MakeStats[]> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.data;
    }

    const { data, error } = await this.adminClient.rpc('get_make_stats');

    if (error) {
      this.logger.warn(`Failed to fetch make stats: ${error.message}`);
      return [];
    }

    const result = (data ?? []).map((row: MakeStatsRow, index: number) => ({
      make: row.make,
      riders: row.riders,
      models: row.distinct_models,
      totalBikes: row.total_bikes,
      rank: index + 1,
    }));

    this.cache = { data: result, expiresAt: Date.now() + MakeStatsService.TTL_MS };
    return result;
  }
}
