import { type MeasurementSystem, mileageToDisplayUnit } from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../../common/supabase/unwrap';
import { ExpensesService } from '../expenses/expenses.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { CreateMaintenanceTaskInput } from './dto/create-maintenance-task.input';
import { MaintenanceTask } from './models/maintenance-task.model';
import type { MaintenanceTaskLineItem } from './models/task-line-item.model';
import type { TaskPhoto } from './models/task-photo.model';
import {
  type MaintenanceLineItemInput,
  MaintenanceLineItemsService,
} from './services/maintenance-line-items.service';
import { MaintenanceSpendingService } from './services/maintenance-spending.service';
import { MaintenanceTaskPhotosService } from './services/maintenance-task-photos.service';

const MAINTENANCE_TASKS_TABLE = 'maintenance_tasks';
const MOTORCYCLES_TABLE = 'motorcycles';
const USERS_TABLE = 'users';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Default recurrence for a "remind me for the next <type>" with no interval given. */
const DEFAULT_REMINDER_INTERVAL_DAYS = 365;

/** Humanize a canonical service-type key for a task title ("oil_change" → "Oil change"). */
function humanizeServiceType(key: string): string {
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Explicit column list for a maintenance task row (typed select instead of
 * `select('*')`). MUST stay in sync with the columns `mapRow` reads.
 */
const MAINTENANCE_TASK_SELECT = [
  'id',
  'user_id',
  'motorcycle_id',
  'title',
  'description',
  'due_date',
  'target_mileage',
  'priority',
  'status',
  'notes',
  'parts_needed',
  'completed_at',
  'completed_mileage',
  'cost',
  'parts_cost',
  'labor_cost',
  'total_amount',
  'tax_amount',
  'tax_rate',
  'currency',
  'source',
  'oem_schedule_id',
  'interval_km',
  'interval_days',
  'is_recurring',
  'remind_30d',
  'remind_7d',
  'remind_1d',
  'created_at',
  'updated_at',
].join(', ');

// Re-export so existing consumers (receipt-scan saga) keep their import site.
export type { MaintenanceLineItemInput } from './services/maintenance-line-items.service';

/**
 * Internal create input: the public GraphQL create input widened with the
 * server-only fields (receipt-scan financial wrapper + attribution) that must
 * NOT be part of the client-facing `CreateMaintenanceTaskInput` contract.
 */
export type CreateMaintenanceTaskInternal = CreateMaintenanceTaskInput & {
  /** Authoritative gross paid for the visit (receipt-scan financial wrapper). */
  totalAmount?: number;
  /** Explicit tax/VAT on the visit; kept out of parts/labor (NET). */
  taxAmount?: number;
  /** Printed tax rate as a percentage (e.g. 21). */
  taxRate?: number;
  /**
   * Attribution: 'user' (default) | 'oem' | 'imported' | 'receipt_scan'.
   * Set server-side only (e.g. U7b's saveReceiptScan) — never a GraphQL field.
   */
  source?: string;
};

/** The next-occurrence outcome of completing a (recurring) task. */
export interface CompleteWithNextResult {
  completed: MaintenanceTask;
  nextOccurrence?: MaintenanceTask;
}

/**
 * Maintenance task CRUD + lifecycle. Photo, line-item, and spend concerns are
 * delegated to focused sub-services under `services/` (mirrors trips/ and
 * expenses/); this service composes them and remains the module's public
 * entry point so external consumers (receipt-scan saga, diagnostics) keep a
 * single injection point.
 *
 * Pagination note: `findByMotorcycle` / `findAllHistory` return plain arrays
 * (not Relay connections) because the mobile task/history queries consume
 * arrays directly. Cursor pagination is deferred to avoid breaking those
 * contracts; `findAllHistory` already bounds its result with a `limit`.
 */
@Injectable()
export class MaintenanceTasksService {
  private readonly logger = new Logger(MaintenanceTasksService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly expensesService: ExpensesService,
    private readonly photosService: MaintenanceTaskPhotosService,
    private readonly lineItemsService: MaintenanceLineItemsService,
    private readonly spendingService: MaintenanceSpendingService,
  ) {}

  async findAllForUser(userId: string): Promise<MaintenanceTask[]> {
    this.logger.debug(`findAllForUser: userId=${userId}`);

    // Get IDs of active (non-deleted) motorcycles
    const activeBikes = unwrap(
      await this.supabase
        .from(MOTORCYCLES_TABLE)
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null),
      { logger: this.logger, op: 'findAllForUser', message: 'Failed to fetch maintenance tasks' },
    );

    const activeBikeIds = (activeBikes ?? []).map((b) => b.id as string);
    if (activeBikeIds.length === 0) {
      this.logger.debug('findAllForUser: no active bikes, returning empty');
      return [];
    }

    const data = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .select(MAINTENANCE_TASK_SELECT)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .in('motorcycle_id', activeBikeIds)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: true }),
      { logger: this.logger, op: 'findAllForUser', message: 'Failed to fetch maintenance tasks' },
    );
    this.logger.debug(`findAllForUser: found ${data?.length ?? 0} tasks`);
    return (data ?? []).map((row) => this.mapRow(row as unknown as Record<string, unknown>));
  }

  async findByMotorcycle(userId: string, motorcycleId: string): Promise<MaintenanceTask[]> {
    this.logger.debug(`findByMotorcycle: userId=${userId}, motorcycleId=${motorcycleId}`);
    const data = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .select(MAINTENANCE_TASK_SELECT)
        .eq('user_id', userId)
        .eq('motorcycle_id', motorcycleId)
        .is('deleted_at', null)
        .order('status', { ascending: true })
        .order('priority', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false }),
      { logger: this.logger, op: 'findByMotorcycle', message: 'Failed to fetch maintenance tasks' },
    );
    this.logger.debug(`findByMotorcycle: found ${data?.length ?? 0} tasks`);
    return (data ?? []).map((row) => this.mapRow(row as unknown as Record<string, unknown>));
  }

  async create(userId: string, input: CreateMaintenanceTaskInternal): Promise<MaintenanceTask> {
    this.logger.log(
      `create: userId=${userId}, title=${input.title}, motorcycleId=${input.motorcycleId}`,
    );
    // When the client logs already-completed work, stamp the completion columns
    // so the record lands in history (not as a pending/overdue task). completedAt
    // falls back to now() when the caller omits it.
    const isCompleted = input.status === 'completed';
    // Defense-in-depth beyond the Zod refinement: never persist a future
    // completion timestamp even if validation is bypassed — clamp to now.
    const now = new Date();
    const providedCompletedAt = input.completedAt ? new Date(input.completedAt) : null;
    const completedAtIso =
      providedCompletedAt && providedCompletedAt <= now
        ? providedCompletedAt.toISOString()
        : now.toISOString();
    const data = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .insert({
          user_id: userId,
          motorcycle_id: input.motorcycleId,
          title: input.title,
          description: input.description,
          due_date: input.dueDate,
          target_mileage: input.targetMileage,
          priority: input.priority ?? 'medium',
          notes: input.notes,
          parts_needed: input.partsNeeded,
          is_recurring: input.isRecurring ?? false,
          interval_km: input.intervalKm ?? null,
          interval_days: input.intervalDays ?? null,
          // MOT-139 — only set when provided, let DB defaults apply otherwise
          ...(input.remind30d !== undefined && { remind_30d: input.remind30d }),
          ...(input.remind7d !== undefined && { remind_7d: input.remind7d }),
          ...(input.remind1d !== undefined && { remind_1d: input.remind1d }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.source !== undefined && { source: input.source }),
          ...(input.cost !== undefined && { cost: input.cost }),
          ...(input.partsCost !== undefined && { parts_cost: input.partsCost }),
          ...(input.laborCost !== undefined && { labor_cost: input.laborCost }),
          ...(input.totalAmount !== undefined && { total_amount: input.totalAmount }),
          ...(input.taxAmount !== undefined && { tax_amount: input.taxAmount }),
          ...(input.taxRate !== undefined && { tax_rate: input.taxRate }),
          ...(input.currency !== undefined && { currency: input.currency }),
          ...(isCompleted && {
            completed_at: completedAtIso,
            completed_mileage: input.completedMileage ?? null,
          }),
        })
        .select(MAINTENANCE_TASK_SELECT)
        .single(),
      {
        logger: this.logger,
        op: 'create',
        message: 'Failed to create maintenance task',
        error: BadRequestException,
      },
    );

    const created = this.mapRow(data as unknown as Record<string, unknown>);
    // R4 gap: a task created ALREADY completed with a cost fires the auto-expense
    // too — createFromTask previously fired only from complete().
    await this.createAutoExpenseIfNeeded(userId, created);
    return created;
  }

  /**
   * Fire the linked maintenance expense for a completed task. Guard-claused and
   * non-blocking: a no-op unless the task is completed with a positive total,
   * and auto-expense failure never fails the originating task write. Shared by
   * create() (create-as-completed) and complete().
   */
  private async createAutoExpenseIfNeeded(userId: string, task: MaintenanceTask): Promise<void> {
    if (task.status !== 'completed') return;
    // Prefer the authoritative gross total (receipt-scan wrapper); fall back to the
    // additive breakdown for tasks that carry no explicit total.
    const totalCost =
      task.totalAmount ?? (task.cost ?? 0) + (task.partsCost ?? 0) + (task.laborCost ?? 0);
    if (totalCost <= 0) return;

    try {
      await this.expensesService.createFromTask(
        userId,
        task.motorcycleId,
        task.id,
        totalCost,
        task.title,
        // Preserve the task's currency (e.g. a scanned receipt's currency) so the
        // linked auto-expense is not silently coerced to the profile default.
        task.currency,
        // Date the expense on the day the service happened (task completion),
        // not "today" — a backdated/scanned invoice must land on its real date.
        task.completedAt,
      );
    } catch (err) {
      this.logger.warn(`Auto-expense creation failed for task ${task.id}: ${err}`);
    }
  }

  async update(
    userId: string,
    id: string,
    input: {
      title?: string;
      description?: string;
      dueDate?: string;
      targetMileage?: number;
      priority?: string;
      notes?: string;
      partsNeeded?: string[];
      // MOT-139 multi-stage reminder flags
      remind30d?: boolean;
      remind7d?: boolean;
      remind1d?: boolean;
    },
  ): Promise<MaintenanceTask> {
    this.logger.log(
      `update: userId=${userId}, taskId=${id}, fields=${Object.keys(input).join(',')}`,
    );
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.dueDate !== undefined) updates.due_date = input.dueDate;
    if (input.targetMileage !== undefined) updates.target_mileage = input.targetMileage;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.partsNeeded !== undefined) updates.parts_needed = input.partsNeeded;
    // MOT-139 reminder flags
    if (input.remind30d !== undefined) updates.remind_30d = input.remind30d;
    if (input.remind7d !== undefined) updates.remind_7d = input.remind7d;
    if (input.remind1d !== undefined) updates.remind_1d = input.remind1d;

    const data = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select(MAINTENANCE_TASK_SELECT)
        .single(),
      {
        logger: this.logger,
        op: 'update',
        message: 'Failed to update maintenance task',
        error: BadRequestException,
      },
    );
    return this.mapRow(data as unknown as Record<string, unknown>);
  }

  async complete(
    userId: string,
    id: string,
    input?: {
      completedMileage?: number;
      cost?: number;
      partsCost?: number;
      laborCost?: number;
      currency?: string;
    },
  ): Promise<MaintenanceTask> {
    this.logger.log(`complete: userId=${userId}, taskId=${id}`);
    const updates: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    };
    if (input?.completedMileage !== undefined) updates.completed_mileage = input.completedMileage;
    if (input?.cost !== undefined) updates.cost = input.cost;
    if (input?.partsCost !== undefined) updates.parts_cost = input.partsCost;
    if (input?.laborCost !== undefined) updates.labor_cost = input.laborCost;
    if (input?.currency !== undefined) updates.currency = input.currency;

    const data = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress'])
        .is('deleted_at', null)
        .select(MAINTENANCE_TASK_SELECT)
        .single(),
      {
        logger: this.logger,
        op: 'complete',
        message: 'Failed to complete maintenance task',
        error: BadRequestException,
      },
    );

    const completed = this.mapRow(data as unknown as Record<string, unknown>);
    await this.createAutoExpenseIfNeeded(userId, completed);
    return completed;
  }

  /**
   * Complete a task and, when it recurs (or the caller forces it), create the
   * next occurrence — the orchestration previously inlined in the resolver.
   */
  async completeWithNextOccurrence(
    userId: string,
    id: string,
    input:
      | {
          completedMileage?: number;
          cost?: number;
          partsCost?: number;
          laborCost?: number;
          currency?: string;
        }
      | undefined,
    createNextOccurrence: boolean | null,
  ): Promise<CompleteWithNextResult> {
    const completed = await this.complete(userId, id, input);
    const shouldCreateNext = createNextOccurrence ?? completed.isRecurring;
    const nextOccurrence = shouldCreateNext
      ? ((await this.createNextRecurrence(completed)) ?? undefined)
      : undefined;
    return { completed, nextOccurrence };
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    this.logger.log(`softDelete: userId=${userId}, taskId=${id}`);
    const { data, error } = await this.supabase.rpc('soft_delete_maintenance_task', {
      task_id: id,
    });

    if (error) {
      this.logger.error(`softDelete failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to delete maintenance task');
    }
    if (data === false) {
      throw new NotFoundException('Maintenance task not found');
    }

    // R5/R10: purge private receipt objects attached to the deleted task from
    // storage (not just the DB link rows). Legacy public photos are unaffected.
    await this.photosService.purgeReceiptsPhotos(userId, id);
    // Soft-delete sets deleted_at, so the task_id ON DELETE CASCADE never fires —
    // purge structured line items here too (parity with the receipt-scan rollback),
    // otherwise a user-deleted scanned task leaves orphan line-item rows.
    await this.lineItemsService.deleteLineItems(userId, id);
    return true;
  }

  async findAllHistory(
    userId: string,
    motorcycleId: string,
    limit = 100,
  ): Promise<MaintenanceTask[]> {
    this.logger.debug(
      `findAllHistory: userId=${userId}, motorcycleId=${motorcycleId}, limit=${limit}`,
    );
    const data = unwrap(
      await this.supabase
        .from(MAINTENANCE_TASKS_TABLE)
        .select(MAINTENANCE_TASK_SELECT)
        .eq('user_id', userId)
        .eq('motorcycle_id', motorcycleId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit),
      {
        logger: this.logger,
        op: 'findAllHistory',
        message: 'Failed to fetch maintenance task history',
      },
    );
    return (data ?? []).map((row) => this.mapRow(row as unknown as Record<string, unknown>));
  }

  async createNextRecurrence(completedTask: MaintenanceTask): Promise<MaintenanceTask | null> {
    this.logger.log(
      `createNextRecurrence: taskId=${completedTask.id}, isRecurring=${completedTask.isRecurring}`,
    );
    if (!completedTask.isRecurring) return null;

    const now = completedTask.completedAt ? new Date(completedTask.completedAt) : new Date();

    const dueDate = completedTask.intervalDays
      ? new Date(now.getTime() + completedTask.intervalDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // completedMileage is stored RAW in the owner's measurement-system unit, but
    // interval_km is KILOMETRES for OEM-seeded tasks (raw user-unit for
    // user-entered ones). Convert an OEM interval to the user's unit before
    // adding, so an imperial user's next-due isn't inflated ~1.61x
    // (docs/plans/odometer-unit-normalization.md).
    let targetMileage: number | null = null;
    if (completedTask.intervalKm && completedTask.completedMileage) {
      const { data: userRow } = await this.adminClient
        .from(USERS_TABLE)
        .select('measurement_system')
        .eq('id', completedTask.userId)
        .single();
      const system = (userRow?.measurement_system as MeasurementSystem | null) ?? 'metric';
      const intervalInUserUnit =
        completedTask.source === 'oem'
          ? Math.round(mileageToDisplayUnit(completedTask.intervalKm, system))
          : completedTask.intervalKm;
      targetMileage = completedTask.completedMileage + intervalInUserUnit;
    }

    // Use the RLS-enforcing user client for this user-scoped write (the admin
    // client bypasses RLS author checks) and log failures — the old path
    // swallowed insert errors with no log, so a broken recurring chain died
    // silently.
    const { data, error } = await this.supabase
      .from(MAINTENANCE_TASKS_TABLE)
      .insert({
        user_id: completedTask.userId,
        motorcycle_id: completedTask.motorcycleId,
        title: completedTask.title,
        description: completedTask.description ?? null,
        due_date: dueDate,
        target_mileage: targetMileage,
        priority: completedTask.priority,
        status: 'pending',
        source: completedTask.source,
        oem_schedule_id: completedTask.oemScheduleId ?? null,
        interval_km: completedTask.intervalKm ?? null,
        interval_days: completedTask.intervalDays ?? null,
        is_recurring: true,
      })
      .select(MAINTENANCE_TASK_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(
        `createNextRecurrence failed for taskId=${completedTask.id}: ${error?.message ?? 'no row returned'}`,
      );
      return null;
    }
    return this.mapRow(data as unknown as Record<string, unknown>);
  }

  /**
   * User-confirmed "remind me for the next <type>" (receipt-scan P7). Creates a
   * NEW recurring pending task of the given canonical service type. It NEVER
   * fuzzy-matches, mutates, or closes an existing pending task — a pure insert,
   * so opting into a reminder can only ever add a task. Defaults to a yearly time
   * cadence when no interval is supplied; the due date anchors the first occurrence.
   */
  async createServiceReminder(
    userId: string,
    input: {
      motorcycleId: string;
      serviceType: string;
      intervalKm?: number;
      intervalDays?: number;
    },
  ): Promise<MaintenanceTask> {
    const intervalDays =
      input.intervalKm != null
        ? input.intervalDays
        : (input.intervalDays ?? DEFAULT_REMINDER_INTERVAL_DAYS);
    const dueDate = intervalDays
      ? new Date(Date.now() + intervalDays * DAY_MS).toISOString().split('T')[0]
      : undefined;
    return this.create(userId, {
      motorcycleId: input.motorcycleId,
      title: humanizeServiceType(input.serviceType),
      priority: 'medium',
      isRecurring: true,
      intervalKm: input.intervalKm,
      intervalDays,
      dueDate,
    });
  }

  // ── Spend rollups (delegated) ──────────────────────────────────────

  getSpendingSummary(
    userId: string,
    motorcycleId: string,
  ): Promise<{ thisYear: number; allTime: number }> {
    return this.spendingService.getSpendingSummary(userId, motorcycleId);
  }

  // ── Photos (delegated) ─────────────────────────────────────────────

  addPhoto(
    userId: string,
    taskId: string,
    storagePath: string,
    fileSizeBytes?: number,
    bucketArg?: string | null,
  ): Promise<TaskPhoto> {
    return this.photosService.addPhoto(userId, taskId, storagePath, fileSizeBytes, bucketArg);
  }

  deletePhoto(userId: string, photoId: string): Promise<boolean> {
    return this.photosService.deletePhoto(userId, photoId);
  }

  findPhotosByTaskIds(taskIds: string[], ownerUserId: string): Promise<Map<string, TaskPhoto[]>> {
    return this.photosService.findPhotosByTaskIds(taskIds, ownerUserId);
  }

  // ── Line items (delegated) ─────────────────────────────────────────

  addLineItems(userId: string, taskId: string, items: MaintenanceLineItemInput[]): Promise<number> {
    return this.lineItemsService.addLineItems(userId, taskId, items);
  }

  deleteLineItems(userId: string, taskId: string): Promise<void> {
    return this.lineItemsService.deleteLineItems(userId, taskId);
  }

  findLineItemsByTaskIds(
    taskIds: string[],
    ownerUserId: string,
  ): Promise<Map<string, MaintenanceTaskLineItem[]>> {
    return this.lineItemsService.findLineItemsByTaskIds(taskIds, ownerUserId);
  }

  // ── Row mapping ────────────────────────────────────────────────────

  private mapRow(row: Record<string, unknown>): MaintenanceTask {
    // photos / lineItems are intentionally NOT seeded here — they are resolved
    // on demand by the request-scoped DataLoaders in the resolver (matches
    // expenses/). Seeding empty arrays would defeat the loader short-circuit.
    return {
      id: row.id as string,
      userId: row.user_id as string,
      motorcycleId: row.motorcycle_id as string,
      title: row.title as string,
      description: (row.description as string) ?? undefined,
      dueDate: (row.due_date as string) ?? undefined,
      targetMileage: (row.target_mileage as number) ?? undefined,
      priority: row.priority as string,
      status: row.status as string,
      notes: (row.notes as string) ?? undefined,
      partsNeeded: (row.parts_needed as string[]) ?? undefined,
      completedAt: (row.completed_at as string) ?? undefined,
      completedMileage: (row.completed_mileage as number) ?? undefined,
      cost: (row.cost as number) ?? undefined,
      partsCost: (row.parts_cost as number) ?? undefined,
      laborCost: (row.labor_cost as number) ?? undefined,
      totalAmount: (row.total_amount as number) ?? undefined,
      taxAmount: (row.tax_amount as number) ?? undefined,
      taxRate: (row.tax_rate as number) ?? undefined,
      currency: (row.currency as string) ?? undefined,
      source: (row.source as string) ?? 'user',
      oemScheduleId: (row.oem_schedule_id as string) ?? undefined,
      intervalKm: (row.interval_km as number) ?? undefined,
      intervalDays: (row.interval_days as number) ?? undefined,
      isRecurring: (row.is_recurring as boolean) ?? false,
      // MOT-139: multi-stage reminder flags with legacy defaults
      remind30d: (row.remind_30d as boolean) ?? false,
      remind7d: (row.remind_7d as boolean) ?? false,
      remind1d: (row.remind_1d as boolean) ?? true,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
