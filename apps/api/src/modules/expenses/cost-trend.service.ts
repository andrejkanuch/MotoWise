import {
  COST_TREND_MONTHS,
  COST_TREND_SECTION,
  type CostTrend,
  CostTrendSchema,
} from '@motovault/types';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTier } from '../../common/entitlements/resolve-tier';
import { unwrap } from '../../common/supabase/unwrap';
import { resolveRiderTimeZone } from '../../common/time-zone/rider-time-zone';
import { TIERS } from '../entitlements/entitlements.types';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { RevenueCatService } from '../webhooks/revenuecat.service';

export const EXPENSE_COST_TREND_RPC = 'expense_cost_trend';

/** The expense_cost_trend RPC result (migration 00203). Keys are the RPC's snake_case. */
export interface CostTrendRow {
  from_month: string;
  to_month: string;
  expense_count: number;
  series: {
    currency: string;
    expense_count: number;
    total: number;
    months: { month: string; total: number }[];
  }[];
}

export interface CostTrendArgs {
  timeZone?: string | null;
  /** Ask RevenueCat first, so a purchase the webhook has not delivered yet unlocks now. */
  refreshEntitlement?: boolean | null;
}

const ALL_SECTIONS = Object.values(COST_TREND_SECTION);

/**
 * Turns one expense_cost_trend row into the `expenseCostTrend` contract. The
 * response is BUILT from an allowlist: a free rider's response has no field
 * that holds money, so a key added to the RPC later cannot reach a free client.
 */
function buildCostTrend(row: CostTrendRow, isPro: boolean, timeZone: string): CostTrend {
  const first = row.series[0];
  const headline = {
    isPro,
    timeZone,
    fromMonth: row.from_month,
    toMonth: row.to_month,
    expenseCount: row.expense_count,
    currency: first?.currency ?? null,
    otherCurrencyExpenseCount: row.expense_count - (first?.expense_count ?? 0),
  };
  if (!isPro) return { ...headline, lockedSections: ALL_SECTIONS, series: null };
  return {
    ...headline,
    lockedSections: [],
    series: row.series.map((s) => ({
      currency: s.currency,
      expenseCount: s.expense_count,
      total: s.total,
      months: s.months.map((m) => ({ month: m.month, total: m.total })),
    })),
  };
}

@Injectable()
export class CostTrendService {
  private readonly logger = new Logger(CostTrendService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly revenueCatService: RevenueCatService,
  ) {}

  /**
   * The cost trend of one bike. The rider's real tier is resolved (never
   * `user.tier`, which reads Pro for everyone while enforcement is off) while
   * the trend is read. The RPC runs on the user client, so RLS and auth.uid()
   * scope it to the rider's own live expenses.
   */
  async getCostTrend(
    userId: string,
    motorcycleId: string,
    args: CostTrendArgs = {},
  ): Promise<CostTrend> {
    const [isPro, { row, timeZone }] = await Promise.all([
      this.isPro(userId, args.refreshEntitlement),
      this.readTrend(userId, motorcycleId, args.timeZone),
    ]);

    const parsed = CostTrendSchema.safeParse(buildCostTrend(row, isPro, timeZone));
    if (!parsed.success) {
      this.logger.error(`costTrend failed its contract for ${userId}: ${parsed.error.message}`);
      throw new InternalServerErrorException('Could not build the cost trend');
    }
    return parsed.data;
  }

  private async isPro(userId: string, refreshEntitlement?: boolean | null): Promise<boolean> {
    if (refreshEntitlement) await this.revenueCatService.fetchSubscriberEntitlements(userId);
    return (await resolveTier(this.supabaseAdmin, userId)) === TIERS.PRO;
  }

  private async readTrend(
    userId: string,
    motorcycleId: string,
    requestedZone?: string | null,
  ): Promise<{ row: CostTrendRow; timeZone: string }> {
    const timeZone = await resolveRiderTimeZone(this.supabaseAdmin, userId, requestedZone);
    const result = await this.supabase.rpc(EXPENSE_COST_TREND_RPC, {
      p_motorcycle_id: motorcycleId,
      p_tz: timeZone,
      p_months: COST_TREND_MONTHS,
    });
    const row = unwrap<CostTrendRow>(result, {
      logger: this.logger,
      op: 'getCostTrend',
      message: 'Could not read the cost trend',
    });
    return { row, timeZone };
  }
}
