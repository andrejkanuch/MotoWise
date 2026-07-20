import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../../../common/supabase/unwrap';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { MaintenanceTaskLineItem } from '../models/task-line-item.model';

const LINE_ITEMS_TABLE = 'maintenance_task_line_items';
const LINE_ITEM_SELECT =
  'id, task_id, service_type, label, part_ref, quantity, unit_price, line_total, sort_order, created_at';

/** A resolved line item to persist (serviceType already classified by the caller). */
export interface MaintenanceLineItemInput {
  serviceType: string;
  label: string;
  partRef?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
}

/**
 * Structured maintenance line items (receipt-scan structured history). Split out
 * of the monolithic MaintenanceTasksService so the task module mirrors the
 * services/ + loaders/ shape of trips/ and expenses/.
 */
@Injectable()
export class MaintenanceLineItemsService {
  private readonly logger = new Logger(MaintenanceLineItemsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  /**
   * Persist structured service line items for a task (own-user, RLS-enforced via
   * the user client). `serviceType` is pre-classified by the caller. Best-effort
   * per the receipt-scan saga: throws so the compensating rollback can fire.
   */
  async addLineItems(
    userId: string,
    taskId: string,
    items: MaintenanceLineItemInput[],
  ): Promise<number> {
    if (items.length === 0) return 0;
    const rows = items.map((item, index) => ({
      task_id: taskId,
      user_id: userId,
      service_type: item.serviceType,
      label: item.label,
      part_ref: item.partRef ?? null,
      quantity: item.quantity ?? null,
      unit_price: item.unitPrice ?? null,
      line_total: item.lineTotal ?? null,
      sort_order: index,
    }));
    const data = unwrap(await this.supabase.from(LINE_ITEMS_TABLE).insert(rows).select('id'), {
      logger: this.logger,
      op: 'addLineItems',
      message: 'Failed to add maintenance line items',
      error: BadRequestException,
    });
    return data?.length ?? 0;
  }

  /** Remove all line items for a task (receipt-scan save rollback / undo cleanup). */
  async deleteLineItems(userId: string, taskId: string): Promise<void> {
    const { error } = await this.supabase
      .from(LINE_ITEMS_TABLE)
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId);
    if (error) this.logger.warn(`deleteLineItems failed for task ${taskId}: ${error.message}`);
  }

  /** Batched line-item fetch for the request-scoped DataLoader (own-user via RLS). */
  async findLineItemsByTaskIds(
    taskIds: string[],
    _ownerUserId: string,
  ): Promise<Map<string, MaintenanceTaskLineItem[]>> {
    const map = new Map<string, MaintenanceTaskLineItem[]>();
    for (const id of taskIds) map.set(id, []);
    if (taskIds.length === 0) return map;

    const data = unwrap(
      await this.supabase
        .from(LINE_ITEMS_TABLE)
        .select(LINE_ITEM_SELECT)
        .in('task_id', taskIds)
        .order('sort_order', { ascending: true }),
      { logger: this.logger, op: 'findLineItemsByTaskIds', message: 'Failed to fetch line items' },
    );

    for (const row of data ?? []) {
      const item = this.mapLineItemRow(row as unknown as Record<string, unknown>);
      const list = map.get(item.taskId) ?? [];
      list.push(item);
      map.set(item.taskId, list);
    }
    return map;
  }

  private mapLineItemRow(row: Record<string, unknown>): MaintenanceTaskLineItem {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      serviceType: row.service_type as string,
      label: row.label as string,
      partRef: (row.part_ref as string) ?? null,
      quantity: (row.quantity as number) ?? null,
      unitPrice: (row.unit_price as number) ?? null,
      lineTotal: (row.line_total as number) ?? null,
      createdAt: row.created_at as string,
    };
  }
}
