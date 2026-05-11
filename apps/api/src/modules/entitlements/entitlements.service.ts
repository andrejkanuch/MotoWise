import { GPX_EXPORT_LIMITS } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { FEATURES, type Feature, GATING_MATRIX, type Tier } from './entitlements.types';
import type { QuotaStatus } from './quota-status.dto';

const FEATURE_GPX_EXPORT = FEATURES.DOWNLOAD_GPX;

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient) {}

  /**
   * Check if a user has access to a specific feature.
   * Uses the GATING_MATRIX from entitlements.types.ts.
   * Tier is resolved once per request by GqlAuthGuard and attached to user.tier.
   *
   * @param user - AuthUser with tier from request context, or null for anonymous
   * @param feature - Feature key from FEATURES constant
   */
  can(user: { id: string; tier?: Tier } | null, feature: Feature): boolean {
    if (!user) return GATING_MATRIX.anonymous[feature];
    const tier: Tier = user.tier ?? 'free';
    return GATING_MATRIX[tier][feature];
  }

  /**
   * Get the current GPX export quota status for a user.
   * Uses the year_month generated column for monthly windowing — no cron needed.
   *
   * @param userId - The user's ID
   * @param tier - The user's effective tier, already resolved by GqlAuthGuard
   */
  async getGPXQuotaStatus(userId: string, tier: Tier = 'free'): Promise<QuotaStatus> {
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const limit =
      tier === 'pro'
        ? GPX_EXPORT_LIMITS.PRO_MONTHLY_EXPORTS
        : GPX_EXPORT_LIMITS.FREE_MONTHLY_EXPORTS;

    // Count usage this month using the year_month generated column
    const { count, error: countError } = await this.supabaseAdmin
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
