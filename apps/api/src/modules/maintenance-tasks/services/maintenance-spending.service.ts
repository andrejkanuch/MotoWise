import { type CurrencyTotal, groupTotalsByCurrency, primaryCurrencyTotal } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../../../common/supabase/unwrap';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';

const MAINTENANCE_TASKS_TABLE = 'maintenance_tasks';
/**
 * Money columns summed per completed task. `total_amount` (authoritative,
 * receipt-scan wrapper) when set, else the additive cost+parts+labor breakdown.
 */
const MONEY_COLS = 'cost, parts_cost, labor_cost, total_amount, currency';

/**
 * Effective money for a completed task: the authoritative gross `total_amount`
 * (receipt-scan financial wrapper) when present, else the additive
 * cost+parts+labor breakdown. Single source of truth for spend aggregation so a
 * scanned task (money in total_amount, cost NULL) is never dropped. Operates on a
 * raw snake_case row.
 */
export function effectiveTaskTotal(row: Record<string, unknown>): number {
  const total = row.total_amount;
  if (total != null) return Number(total) || 0;
  return (Number(row.cost) || 0) + (Number(row.parts_cost) || 0) + (Number(row.labor_cost) || 0);
}

/**
 * Sums completed tasks' effective money per currency (never across currencies:
 * there is no FX source). Tasks with no money are left out so they do not
 * decide which currency counts as most-used.
 */
export function spendByCurrency(rows: ReadonlyArray<Record<string, unknown>>): CurrencyTotal[] {
  return groupTotalsByCurrency(
    rows
      .map((row) => ({ amount: effectiveTaskTotal(row), currency: row.currency as string | null }))
      .filter(({ amount }) => amount !== 0),
  );
}

/** Completed-maintenance spend, per currency plus the legacy scalar fields. */
export interface SpendingSummaryResult {
  thisYear: number;
  allTime: number;
  thisYearByCurrency: CurrencyTotal[];
  allTimeByCurrency: CurrencyTotal[];
}

/**
 * Maintenance spend rollups. Split out of the monolithic MaintenanceTasksService
 * (services/ shape, mirrors trips/).
 */
@Injectable()
export class MaintenanceSpendingService {
  private readonly logger = new Logger(MaintenanceSpendingService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async getSpendingSummary(userId: string, motorcycleId: string): Promise<SpendingSummaryResult> {
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    const allTimeData = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .select(MONEY_COLS)
        .eq('user_id', userId)
        .eq('motorcycle_id', motorcycleId)
        .eq('status', 'completed')
        .is('deleted_at', null),
      {
        logger: this.logger,
        op: 'getSpendingSummary',
        message: 'Failed to fetch spending summary',
      },
    );

    const allTimeByCurrency = spendByCurrency(
      (allTimeData ?? []) as unknown as Record<string, unknown>[],
    );

    const yearData = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .select(MONEY_COLS)
        .eq('user_id', userId)
        .eq('motorcycle_id', motorcycleId)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .gte('completed_at', yearStart),
      {
        logger: this.logger,
        op: 'getSpendingSummary',
        message: 'Failed to fetch spending summary',
      },
    );

    const thisYearByCurrency = spendByCurrency(
      (yearData ?? []) as unknown as Record<string, unknown>[],
    );

    // The scalars carry the most-used currency only — never a mixed sum.
    return {
      thisYear: primaryCurrencyTotal(thisYearByCurrency),
      allTime: primaryCurrencyTotal(allTimeByCurrency),
      thisYearByCurrency,
      allTimeByCurrency,
    };
  }
}
