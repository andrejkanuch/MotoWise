import { AI_BUDGET_LIMITS, AI_FEATURE_LIMITS, FREE_TIER_LIMITS } from '@motovault/types';
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
import type { Redis } from '@upstash/redis';
import { type AiModel, costCentsFor, DURATIONS } from '../../config/constants';
import { REDIS } from '../redis/redis.constants';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

const CIRCUIT_BREAKER_KEY = 'ai:circuit_breaker';

/** Error token raised by the reserve_ai_generation RPC when the quota is hit */
const DAILY_LIMIT_EXCEEDED = 'daily_limit_exceeded';

/** content_generation_log.content_type values metered by this service */
export const AI_CONTENT_TYPES = {
  ARTICLE: 'article',
  TRIP_ASSISTANT: 'trip_assistant',
  DIAGNOSTIC: 'diagnostic',
  RIDE_SUMMARY: 'ride_summary',
  ONBOARDING_INSIGHTS: 'onboarding_insights',
} as const;

export type AiContentType = (typeof AI_CONTENT_TYPES)[keyof typeof AI_CONTENT_TYPES];

const LIMIT_PERIODS = {
  DAY: 'day',
  MONTH: 'month',
} as const;

type LimitPeriod = (typeof LIMIT_PERIODS)[keyof typeof LIMIT_PERIODS];

interface FeatureLimitRule {
  period: LimitPeriod;
  limit: number;
  upsell: string;
}

/**
 * Free-tier per-feature quota rules, keyed by content_generation_log content
 * type. Replaces the three copy-pasted enforce* blocks that previously lived
 * in article-generator, trip-assistant, and the diagnostics resolver.
 */
const AI_FEATURE_LIMIT_RULES = {
  [AI_CONTENT_TYPES.ARTICLE]: {
    period: LIMIT_PERIODS.MONTH,
    limit: FREE_TIER_LIMITS.MAX_ARTICLES_PER_MONTH,
    upsell: `Free plan allows up to ${FREE_TIER_LIMITS.MAX_ARTICLES_PER_MONTH} articles per month. Upgrade to Pro for unlimited articles.`,
  },
  [AI_CONTENT_TYPES.TRIP_ASSISTANT]: {
    period: LIMIT_PERIODS.MONTH,
    limit: AI_FEATURE_LIMITS.FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH,
    upsell: `Free plan allows ${AI_FEATURE_LIMITS.FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH} trip assistant questions per month. Upgrade to Pro for more trip planning help.`,
  },
  [AI_CONTENT_TYPES.DIAGNOSTIC]: {
    period: LIMIT_PERIODS.MONTH,
    limit: FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH,
    upsell: `Free plan allows ${FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH} AI diagnostics per month. Upgrade to Pro for unlimited diagnostics.`,
  },
} as const satisfies Partial<Record<AiContentType, FeatureLimitRule>>;

export type LimitedAiFeature = keyof typeof AI_FEATURE_LIMIT_RULES;

const GENERATION_OUTCOMES = {
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

type GenerationOutcome = (typeof GENERATION_OUTCOMES)[keyof typeof GENERATION_OUTCOMES];

export interface RecordGenerationParams {
  reservationId: string;
  model: AiModel;
  inputTokens: number;
  outputTokens: number;
  status: GenerationOutcome;
  contentId?: string;
  errorMessage?: string;
}

@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  /** In-memory fallback when Redis is unavailable (dev/test) */
  private circuitBreakerFallback = false;

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

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
    const isOpen = await this.isCircuitBreakerOpen();
    if (isOpen) {
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

  private async isCircuitBreakerOpen(): Promise<boolean> {
    if (!this.redis) return this.circuitBreakerFallback;

    try {
      const value = await this.redis.get<string>(CIRCUIT_BREAKER_KEY);
      return value === 'open';
    } catch (err) {
      this.logger.warn(
        'Redis unavailable for circuit breaker check, using in-memory fallback',
        err,
      );
      return this.circuitBreakerFallback;
    }
  }

  private async setCircuitBreaker(open: boolean): Promise<void> {
    this.circuitBreakerFallback = open;

    if (!this.redis) return;

    try {
      if (open) {
        // Auto-expire after 24h as a safety net
        await this.redis.set(CIRCUIT_BREAKER_KEY, 'open', {
          ex: DURATIONS.CIRCUIT_BREAKER_EXPIRE_SECONDS,
        });
      } else {
        await this.redis.del(CIRCUIT_BREAKER_KEY);
      }
    } catch (err) {
      this.logger.warn('Redis unavailable for circuit breaker write', err);
    }
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

    const { data, error } = await this.adminClient.rpc('get_daily_ai_spend', {
      p_since: todayStart.toISOString(),
    });

    if (error) {
      this.logger.error('Failed to check global AI spend', error);
      throw new HttpException('AI service temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const totalCents = (data as number) ?? 0;

    if (totalCents >= AI_BUDGET_LIMITS.GLOBAL_DAILY_SPEND_CAP_CENTS) {
      await this.setCircuitBreaker(true);
      this.logger.error(
        `GLOBAL AI CIRCUIT BREAKER TRIPPED: daily spend ${totalCents} cents >= cap ${AI_BUDGET_LIMITS.GLOBAL_DAILY_SPEND_CAP_CENTS} cents ($${(totalCents / 100).toFixed(2)}). All AI generation paused.`,
      );
      throw new InternalServerErrorException(
        'AI generation is temporarily paused. Please try again later.',
      );
    }
  }

  /**
   * Atomically reserve one of the user's daily generations for a content type
   * (audit H6). The RPC takes a per-user advisory lock, counts today's (UTC)
   * non-failed content_generation_log rows, and inserts a 'pending' row that
   * IS the log row — finalize it with recordGeneration(). service_role-only
   * RPC, hence the admin client.
   *
   * @returns the reservation row id (content_generation_log.id)
   */
  async reserveGeneration(
    userId: string,
    contentType: AiContentType,
    dailyLimit: number,
  ): Promise<string> {
    const { data, error } = await this.adminClient.rpc('reserve_ai_generation', {
      p_user_id: userId,
      p_content_type: contentType,
      p_daily_limit: dailyLimit,
    });

    if (error) {
      if (error.message?.includes(DAILY_LIMIT_EXCEEDED)) {
        this.logger.warn(
          `User ${userId} hit daily ${contentType} limit: ${dailyLimit}/${dailyLimit}`,
        );
        throw new ForbiddenException(
          `You've reached your daily AI generation limit (${dailyLimit}). Upgrade to Pro for more generations.`,
        );
      }
      // Fail closed: without a reservation row the generation would be
      // invisible to budgets and the global spend cap.
      this.logger.error('reserve_ai_generation RPC failed', error);
      throw new InternalServerErrorException('Unable to reserve AI generation. Please try again.');
    }

    return data as string;
  }

  /**
   * Finalize a pending reservation row with the real model/token usage and
   * outcome. Cost is derived internally via costCentsFor so callers can't
   * drift from MODEL_COSTS. Logs (never throws) on failure — the generation
   * result has already been produced at this point.
   */
  async recordGeneration(params: RecordGenerationParams): Promise<void> {
    const { reservationId, model, inputTokens, outputTokens, status, contentId, errorMessage } =
      params;

    const { error } = await this.adminClient
      .from('content_generation_log')
      .update({
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_cents: costCentsFor(model, inputTokens, outputTokens),
        status,
        ...(contentId && { content_id: contentId }),
        ...(errorMessage && { error_message: errorMessage }),
      })
      .eq('id', reservationId);

    if (error) {
      this.logger.error(`Failed to record AI generation ${reservationId}`, error);
    }
  }

  /**
   * Enforce the free-tier per-feature quota for a content type (dispatch
   * table above). Pro users are never limited. Fails CLOSED on lookup errors
   * — these checks gate paid AI spend (precedent: ride-summaries).
   */
  async enforceFeatureLimit(userId: string, feature: LimitedAiFeature): Promise<void> {
    const rule: FeatureLimitRule = AI_FEATURE_LIMIT_RULES[feature];

    const { data: userData, error: userError } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      this.logger.error(`Failed to fetch subscription tier for ${feature} quota`, userError);
      throw new InternalServerErrorException('Unable to verify subscription status.');
    }

    const tier = (userData?.subscription_tier as 'free' | 'pro') ?? 'free';
    if (tier === 'pro') return;

    const periodStart = this.periodStartUtc(rule.period);

    const { count, error } = await this.adminClient
      .from('content_generation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('content_type', feature)
      .eq('status', 'success')
      .gte('created_at', periodStart.toISOString());

    if (error) {
      this.logger.error(`Failed to count ${rule.period}ly ${feature} usage`, error);
      throw new InternalServerErrorException('Unable to verify your AI usage quota.');
    }

    if ((count ?? 0) >= rule.limit) {
      this.logger.warn(
        `User ${userId} hit free-tier ${feature} limit: ${count}/${rule.limit} per ${rule.period}`,
      );
      throw new ForbiddenException(rule.upsell);
    }
  }

  // date-fns is not an apps/api dependency (root-only hoist), so this uses the
  // same explicit setUTC* pattern as the pre-existing month-start code.
  private periodStartUtc(period: LimitPeriod): Date {
    const start = new Date();
    if (period === LIMIT_PERIODS.MONTH) start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    return start;
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
      this.adminClient.rpc('get_daily_ai_spend', {
        p_since: todayStart.toISOString(),
      }),
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

    const totalCents = (spendResult.data as number) ?? 0;

    return {
      circuitBreakerOpen: await this.isCircuitBreakerOpen(),
      todaySpendCents: totalCents,
      todayGenerationCount: countResult.count ?? 0,
      dailySpendCapCents: AI_BUDGET_LIMITS.GLOBAL_DAILY_SPEND_CAP_CENTS,
    };
  }

  /** Admin: reset the circuit breaker */
  async resetCircuitBreaker(): Promise<void> {
    this.logger.warn('Admin reset AI circuit breaker');
    await this.setCircuitBreaker(false);
  }
}
