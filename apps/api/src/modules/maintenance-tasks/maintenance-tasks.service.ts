import { type MeasurementSystem, mileageToDisplayUnit } from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  deleteReceiptsPhotoObjects,
  PHOTO_BUCKETS,
  type PhotoStorageRow,
  photoBucketOf,
  resolvePhotoUrl,
} from '../../common/storage/photo-storage';
import { ExpensesService } from '../expenses/expenses.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { MaintenanceTask } from './models/maintenance-task.model';
import type { MaintenanceTaskLineItem } from './models/task-line-item.model';
import type { TaskPhoto } from './models/task-photo.model';

const LINE_ITEMS_TABLE = 'maintenance_task_line_items';

/** A resolved line item to persist (serviceType already classified by the caller). */
export interface MaintenanceLineItemInput {
  serviceType: string;
  label: string;
  partRef?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
}

const MAX_PHOTOS_PER_TASK = 5;

@Injectable()
export class MaintenanceTasksService {
  private readonly logger = new Logger(MaintenanceTasksService.name);
  private readonly supabaseUrl: string;

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly expensesService: ExpensesService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
  }

  async findAllForUser(userId: string): Promise<MaintenanceTask[]> {
    this.logger.debug(`findAllForUser: userId=${userId}`);

    // Get IDs of active (non-deleted) motorcycles
    const { data: activeBikes, error: bikesError } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (bikesError) {
      this.logger.error(`findAllForUser bikes lookup failed: ${bikesError.message}`);
      throw new InternalServerErrorException('Failed to fetch maintenance tasks');
    }

    const activeBikeIds = (activeBikes ?? []).map((b) => b.id as string);
    if (activeBikeIds.length === 0) {
      this.logger.debug('findAllForUser: no active bikes, returning empty');
      return [];
    }

    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('motorcycle_id', activeBikeIds)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: true });

    if (error) {
      this.logger.error(`findAllForUser failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch maintenance tasks');
    }
    this.logger.debug(`findAllForUser: found ${data?.length ?? 0} tasks`);
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async findByMotorcycle(userId: string, motorcycleId: string): Promise<MaintenanceTask[]> {
    this.logger.debug(`findByMotorcycle: userId=${userId}, motorcycleId=${motorcycleId}`);
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('status', { ascending: true })
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      this.logger.error(`findByMotorcycle failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch maintenance tasks');
    }
    this.logger.debug(`findByMotorcycle: found ${data?.length ?? 0} tasks`);
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async create(
    userId: string,
    input: {
      motorcycleId: string;
      title: string;
      description?: string;
      dueDate?: string;
      targetMileage?: number;
      priority?: string;
      notes?: string;
      partsNeeded?: string[];
      isRecurring?: boolean;
      intervalKm?: number;
      intervalDays?: number;
      // MOT-139 multi-stage reminder flags
      remind30d?: boolean;
      remind7d?: boolean;
      remind1d?: boolean;
      // Create-as-completed: log work already done in one call.
      status?: string;
      completedAt?: string;
      completedMileage?: number;
      cost?: number;
      partsCost?: number;
      laborCost?: number;
      // Authoritative gross total + explicit tax (receipt-scan financial wrapper).
      totalAmount?: number;
      taxAmount?: number;
      taxRate?: number;
      currency?: string;
      // Attribution: 'user' (default) | 'oem' | 'imported' | 'receipt_scan'.
      // Not a GraphQL field — set server-side (e.g. U7b's saveReceiptScan).
      source?: string;
    },
  ): Promise<MaintenanceTask> {
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
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
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
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create maintenance task');
    }

    const created = this.mapRow(data);
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

    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`update failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to update maintenance task');
    }
    return this.mapRow(data);
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

    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`complete failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to complete maintenance task');
    }

    const completed = this.mapRow(data);
    await this.createAutoExpenseIfNeeded(userId, completed);
    return completed;
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
    await this.purgeReceiptsPhotos(userId, id);
    return true;
  }

  /**
   * Removes the storage OBJECTS + link rows for any receipts-bucket photos
   * attached to a task. Best-effort (logs, never throws).
   */
  private async purgeReceiptsPhotos(userId: string, taskId: string): Promise<void> {
    const { data, error } = await this.adminClient
      .from('maintenance_task_photos')
      .select('id, storage_path, bucket, user_id')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .eq('bucket', PHOTO_BUCKETS.RECEIPTS);

    if (error || !data || data.length === 0) return;

    const { removedPaths } = await deleteReceiptsPhotoObjects({
      rows: data as PhotoStorageRow[],
      ownerUserId: userId,
      adminClient: this.adminClient,
      logger: this.logger,
    });

    // Only drop link rows whose storage object was actually removed — a link for
    // an object that failed to delete is retained so the pair stays consistent
    // (avoids orphaning a private receipt object with no DB link to it).
    const removed = new Set(removedPaths);
    const idsToUnlink = data
      .filter((row) => removed.has(row.storage_path as string))
      .map((row) => row.id);
    if (idsToUnlink.length === 0) return;

    const { error: linkError } = await this.adminClient
      .from('maintenance_task_photos')
      .delete()
      .in('id', idsToUnlink);
    if (linkError) {
      this.logger.warn(`purgeReceiptsPhotos: link-row delete failed: ${linkError.message}`);
    }
  }

  async findAllHistory(
    userId: string,
    motorcycleId: string,
    limit = 100,
  ): Promise<MaintenanceTask[]> {
    this.logger.debug(
      `findAllHistory: userId=${userId}, motorcycleId=${motorcycleId}, limit=${limit}`,
    );
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new InternalServerErrorException('Failed to fetch maintenance task history');
    return (data ?? []).map((row) => this.mapRow(row));
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
        .from('users')
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
      .from('maintenance_tasks')
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
      .select()
      .single();

    if (error || !data) {
      this.logger.error(
        `createNextRecurrence failed for taskId=${completedTask.id}: ${error?.message ?? 'no row returned'}`,
      );
      return null;
    }
    return this.mapRow(data);
  }

  async getSpendingSummary(
    userId: string,
    motorcycleId: string,
  ): Promise<{ thisYear: number; allTime: number }> {
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    // All-time spending
    const { data: allTimeData, error: allTimeError } = await this.supabase
      .from('maintenance_tasks')
      .select('cost')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('cost', 'is', null);

    if (allTimeError) {
      this.logger.error(`getSpendingSummary failed: ${allTimeError.message}`);
      throw new InternalServerErrorException('Failed to fetch spending summary');
    }

    const allTime = (allTimeData ?? []).reduce((sum, row) => sum + (Number(row.cost) || 0), 0);

    // This year spending
    const { data: yearData, error: yearError } = await this.supabase
      .from('maintenance_tasks')
      .select('cost')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('cost', 'is', null)
      .gte('completed_at', yearStart);

    if (yearError) {
      this.logger.error(`getSpendingSummary year failed: ${yearError.message}`);
      throw new InternalServerErrorException('Failed to fetch spending summary');
    }

    const thisYear = (yearData ?? []).reduce((sum, row) => sum + (Number(row.cost) || 0), 0);

    return { thisYear, allTime };
  }

  // ── Photo methods ──────────────────────────────────────────────────

  async addPhoto(
    userId: string,
    taskId: string,
    storagePath: string,
    fileSizeBytes?: number,
    bucketArg?: string | null,
  ): Promise<TaskPhoto> {
    const bucket = photoBucketOf(bucketArg);
    this.logger.log(
      `addPhoto: userId=${userId}, taskId=${taskId}, storagePath=${storagePath}, bucket=${bucket}`,
    );

    // KTD-2: enforce the caller-owned storage prefix server-side before we record
    // the link — prevents a caller from attaching another user's object to their
    // own task and then deleting it via the admin-backed delete flow. Receipts
    // (U7b link) live at the flat server-derived `{uid}/{scanId}.webp`; legacy
    // gallery photos live under `{uid}/{taskId}/` (uploadMaintenancePhoto).
    const expectedPrefix =
      bucket === PHOTO_BUCKETS.RECEIPTS ? `${userId}/` : `${userId}/${taskId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      this.logger.warn(
        `addPhoto: rejected storage path outside expected prefix. userId=${userId}, taskId=${taskId}, bucket=${bucket}`,
      );
      throw new BadRequestException('Invalid storage path');
    }

    // Validate task ownership
    const { data: task, error: taskError } = await this.adminClient
      .from('maintenance_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (taskError || !task) {
      this.logger.warn(
        `addPhoto: task not found or not owned, taskId=${taskId}, error=${taskError?.message}`,
      );
      throw new NotFoundException('Maintenance task not found');
    }

    // Check photo count limit
    const { count, error: countError } = await this.adminClient
      .from('maintenance_task_photos')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if (countError) throw new InternalServerErrorException('Failed to check photo count');
    if ((count ?? 0) >= MAX_PHOTOS_PER_TASK) {
      throw new BadRequestException(`Maximum of ${MAX_PHOTOS_PER_TASK} photos per task`);
    }

    // Determine mime type from storage path
    const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'webp';
    const mimeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
    };
    const mimeType = mimeMap[ext] ?? 'image/webp';

    const { data, error } = await this.adminClient
      .from('maintenance_task_photos')
      .insert({
        task_id: taskId,
        user_id: userId,
        storage_path: storagePath,
        file_size_bytes: fileSizeBytes ?? null,
        mime_type: mimeType,
        bucket,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`addPhoto failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to add photo');
    }
    this.logger.log(`addPhoto success: photoId=${data.id}`);
    const photo = await this.mapPhotoRow(data, userId);
    if (!photo) {
      throw new InternalServerErrorException('Failed to resolve photo URL');
    }
    return photo;
  }

  async deletePhoto(userId: string, photoId: string): Promise<boolean> {
    this.logger.log(`deletePhoto: userId=${userId}, photoId=${photoId}`);
    // Fetch photo and validate ownership via task
    const { data: photo, error: photoError } = await this.adminClient
      .from('maintenance_task_photos')
      .select('id, task_id, storage_path, bucket, user_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) throw new NotFoundException('Photo not found');

    // Validate task ownership
    const { data: task, error: taskError } = await this.adminClient
      .from('maintenance_tasks')
      .select('id')
      .eq('id', photo.task_id)
      .eq('user_id', userId)
      .single();

    if (taskError || !task) throw new NotFoundException('Photo not found');

    // Delete from storage using admin client — dispatch on the row's bucket so a
    // receipts-linked photo hits the private bucket rather than maintenance-photos.
    const { error: storageError } = await this.adminClient.storage
      .from(photoBucketOf(photo.bucket))
      .remove([photo.storage_path]);

    if (storageError) {
      // Log but don't fail — DB record deletion is more important
      this.logger.warn(
        `deletePhoto: storage deletion failed for ${photo.storage_path}: ${storageError.message}`,
      );
    }

    // Delete from DB
    const { error: deleteError } = await this.adminClient
      .from('maintenance_task_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) throw new InternalServerErrorException('Failed to delete photo');
    return true;
  }

  async findPhotosByTaskIds(
    taskIds: string[],
    ownerUserId: string,
  ): Promise<Map<string, TaskPhoto[]>> {
    this.logger.debug(`findPhotosByTaskIds: ${taskIds.length} task(s)`);
    if (taskIds.length === 0) return new Map();

    // User-scoped read: go through the RLS-enforcing user client (maintenance_task_photos
    // policy restricts rows to auth.uid() = user_id). The admin client would bypass
    // RLS; the ownerUserId path check in mapPhotoRow remains as defense in depth.
    const { data, error } = await this.supabase
      .from('maintenance_task_photos')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');

    const map = new Map<string, TaskPhoto[]>();
    for (const taskId of taskIds) {
      map.set(taskId, []);
    }
    // Resolve URLs concurrently — receipts rows mint a signed URL per photo.
    const resolved = await Promise.all(
      (data ?? []).map(async (row) => ({
        taskId: row.task_id as string,
        photo: await this.mapPhotoRow(row, ownerUserId),
      })),
    );
    for (const { taskId, photo } of resolved) {
      if (!photo) continue; // C1: foreign-uid receipts path — never surface it.
      const photos = map.get(taskId) ?? [];
      photos.push(photo);
      map.set(taskId, photos);
    }
    return map;
  }

  /**
   * Maps one photo row into the GraphQL shape, resolving its access URL by
   * bucket (U7a): legacy → public URL; receipts → short-TTL signed URL after the
   * C1 ownership assertion. Returns null when a receipts URL can't be authorized.
   */
  private async mapPhotoRow(
    row: Record<string, unknown>,
    ownerUserId: string,
  ): Promise<TaskPhoto | null> {
    const storagePath = row.storage_path as string;
    const photoRow: PhotoStorageRow = {
      storage_path: storagePath,
      bucket: row.bucket as string | null | undefined,
      user_id: row.user_id as string | null | undefined,
    };
    const publicUrl = await resolvePhotoUrl({
      row: photoRow,
      ownerUserId,
      adminClient: this.adminClient,
      supabaseUrl: this.supabaseUrl,
      logger: this.logger,
    });
    if (publicUrl === null) return null;
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      storagePath,
      publicUrl,
      fileSizeBytes: (row.file_size_bytes as number) ?? undefined,
      mimeType: (row.mime_type as string) ?? 'image/webp',
      createdAt: row.created_at as string,
    };
  }

  // ── Line items (receipt-scan structured history) ───────────────────

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
    const { data, error } = await this.supabase.from(LINE_ITEMS_TABLE).insert(rows).select('id');
    if (error) {
      this.logger.error(`addLineItems failed for task ${taskId}: ${error.message}`);
      throw new BadRequestException('Failed to add maintenance line items');
    }
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

    const { data, error } = await this.supabase
      .from(LINE_ITEMS_TABLE)
      .select('*')
      .in('task_id', taskIds)
      .order('sort_order', { ascending: true });
    if (error) throw new InternalServerErrorException('Failed to fetch line items');

    for (const row of data ?? []) {
      const item = this.mapLineItemRow(row);
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

  private mapRow(row: Record<string, unknown>): MaintenanceTask {
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
      photos: [],
      lineItems: [],
      // MOT-139: multi-stage reminder flags with legacy defaults
      remind30d: (row.remind_30d as boolean) ?? false,
      remind7d: (row.remind_7d as boolean) ?? false,
      remind1d: (row.remind_1d as boolean) ?? true,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
