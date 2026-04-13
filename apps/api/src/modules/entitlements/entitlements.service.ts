import { GPX_EXPORT_LIMITS } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { QuotaStatus } from './quota-status.dto';

const FEATURE_GPX_EXPORT = 'gpx_export';

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  /**
   * Get the current GPX export quota status for a user.
   * Uses the year_month generated column for monthly windowing — no cron needed.
   */
  async getGPXQuotaStatus(userId: string): Promise<QuotaStatus> {
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Determine tier from users table
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      this.logger.error(`Failed to fetch user tier: ${userError.message}`, userError);
      throw new Error('Failed to fetch user subscription tier');
    }

    const tier = (user?.subscription_tier as string) ?? 'free';
    const limit =
      tier === 'pro'
        ? GPX_EXPORT_LIMITS.PRO_MONTHLY_EXPORTS
        : GPX_EXPORT_LIMITS.FREE_MONTHLY_EXPORTS;

    // Count usage this month using the year_month generated column
    const { count, error: countError } = await this.supabase
      .from('user_gating_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature', FEATURE_GPX_EXPORT)
      .eq('year_month', yearMonth);

    if (countError) {
      this.logger.error(`Failed to count gating events: ${countError.message}`, countError);
      throw new Error('Failed to count GPX export usage');
    }

    const used = count ?? 0;

    // Calculate remaining (-1 means unlimited)
    const remaining = limit === -1 ? -1 : Math.max(0, limit - used);
    const isExhausted = limit !== -1 && remaining === 0;

    // Reset date = 1st of next month at 00:00 UTC
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return {
      feature: FEATURE_GPX_EXPORT,
      limit,
      used,
      remaining,
      resetDate: resetDate.toISOString(),
      isExhausted,
    };
  }
}
