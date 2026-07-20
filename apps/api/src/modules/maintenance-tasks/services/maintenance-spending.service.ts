import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../../../common/supabase/unwrap';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';

const MAINTENANCE_TASKS_TABLE = 'maintenance_tasks';
/**
 * Money columns summed per completed task. `total_amount` (authoritative,
 * receipt-scan wrapper) when set, else the additive cost+parts+labor breakdown.
 */
const MONEY_COLS = 'cost, parts_cost, labor_cost, total_amount';

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
 * Maintenance spend rollups. Split out of the monolithic MaintenanceTasksService
 * (services/ shape, mirrors trips/).
 */
@Injectable()
export class MaintenanceSpendingService {
  private readonly logger = new Logger(MaintenanceSpendingService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async getSpendingSummary(
    userId: string,
    motorcycleId: string,
  ): Promise<{ thisYear: number; allTime: number }> {
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

    const allTime = (allTimeData ?? []).reduce(
      (sum, row) => sum + effectiveTaskTotal(row as unknown as Record<string, unknown>),
      0,
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

    const thisYear = (yearData ?? []).reduce(
      (sum, row) => sum + effectiveTaskTotal(row as unknown as Record<string, unknown>),
      0,
    );

    return { thisYear, allTime };
  }
}
