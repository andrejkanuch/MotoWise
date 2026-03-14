import { AI_BUDGET_LIMITS } from '@motovault/types';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  /** In-memory circuit breaker — does NOT work across multiple server instances.
   *  TODO: Move to Redis or DB flag before horizontal scaling. */
  private circuitBreakerOpen = false;

  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  /**
   * Look up the user's subscription tier from DB and check budget.
   * Convenience method for AI services that don't already have the tier.
   */
  async checkBudgetForUser(userId: string): Promise<void> {
    const { data } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = (data?.subscription_tier as 'free' | 'pro') ?? 'free';
    return this.checkBudget(userId, tier);
  }

  /**
   * Check whether the user is allowed to perform an AI generation.
   * Throws ForbiddenException if the user's daily limit is reached.
   * Throws InternalServerErrorException if the global circuit breaker is open.
   */
  async checkBudget(userId: string, subscriptionTier: 'free' | 'pro'): Promise<void> {
    // 1. Check global circuit breaker
    if (this.circuitBreakerOpen) {
      this.logger.error('Global AI circuit breaker is OPEN — all AI generation paused');
      throw new InternalServerErrorException(
        'AI generation is temporarily paused. Please try again later.',
      );
    }

    // 2. Check global daily spend
    await this.checkGlobalSpend();

    // 3. Check per-user daily generation count
    await this.checkUserDailyLimit(userId, subscriptionTier);
  }

  private async checkUserDailyLimit(
    userId: string,
    subscriptionTier: 'free' | 'pro',
  ): Promise<void> {
    const maxGenerations =
      subscriptionTier === 'pro'
        ? AI_BUDGET_LIMITS.PRO_DAILY_GENERATIONS
        : AI_BUDGET_LIMITS.FREE_DAILY_GENERATIONS;

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await this.adminClient
      .from('content_generation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'success');

    if (error) {
      this.logger.error('Failed to check user daily AI limit', error);
      // Fail open for user-level check — global spend check provides financial protection
      return;
    }

    if ((count ?? 0) >= maxGenerations) {
      this.logger.warn(
        `User ${userId} hit daily AI limit: ${count}/${maxGenerations} (tier: ${subscriptionTier})`,
      );
      throw new ForbiddenException(
        `You've reached your daily AI generation limit (${maxGenerations}). ` +
          (subscriptionTier === 'free'
            ? 'Upgrade to Pro for more generations.'
            : 'Please try again tomorrow.'),
      );
    }
  }

  private async checkGlobalSpend(): Promise<void> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await this.adminClient
      .from('content_generation_log')
      .select('cost_cents.sum()')
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'success')
      .single();

    if (error) {
      this.logger.error('Failed to check global AI spend', error);
      throw new HttpException('AI service temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const totalCents = (data as Record<string, number>)?.sum ?? 0;

    if (totalCents >= AI_BUDGET_LIMITS.GLOBAL_DAILY_SPEND_CAP_CENTS) {
      this.circuitBreakerOpen = true;
      this.logger.error(
        `GLOBAL AI CIRCUIT BREAKER TRIPPED: daily spend ${totalCents} cents >= cap ${AI_BUDGET_LIMITS.GLOBAL_DAILY_SPEND_CAP_CENTS} cents ($${(totalCents / 100).toFixed(2)}). All AI generation paused.`,
      );
      throw new InternalServerErrorException(
        'AI generation is temporarily paused. Please try again later.',
      );
    }
  }

  /** Admin: get current budget status */
  async getBudgetStatus(): Promise<{
    circuitBreakerOpen: boolean;
    todaySpendCents: number;
    todayGenerationCount: number;
    dailySpendCapCents: number;
  }> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [spendResult, countResult] = await Promise.all([
      this.adminClient
        .from('content_generation_log')
        .select('cost_cents.sum()')
        .gte('created_at', todayStart.toISOString())
        .eq('status', 'success')
        .single(),
      this.adminClient
        .from('content_generation_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
        .eq('status', 'success'),
    ]);

    if (spendResult.error || countResult.error) {
      this.logger.error('Failed to fetch budget status', spendResult.error ?? countResult.error);
      throw new InternalServerErrorException('Failed to fetch AI budget status');
    }

    const totalCents = (spendResult.data as Record<string, number>)?.sum ?? 0;

    return {
      circuitBreakerOpen: this.circuitBreakerOpen,
      todaySpendCents: totalCents,
      todayGenerationCount: countResult.count ?? 0,
      dailySpendCapCents: AI_BUDGET_LIMITS.GLOBAL_DAILY_SPEND_CAP_CENTS,
    };
  }

  /** Admin: reset the circuit breaker */
  resetCircuitBreaker(): void {
    this.logger.warn('Admin reset AI circuit breaker');
    this.circuitBreakerOpen = false;
  }
}
