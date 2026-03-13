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
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { MaintenanceTask } from './models/maintenance-task.model';
import type { TaskPhoto } from './models/task-photo.model';

const MAX_PHOTOS_PER_TASK = 5;

@Injectable()
export class MaintenanceTasksService {
  private readonly logger = new Logger(MaintenanceTasksService.name);
  private readonly supabaseUrl: string;

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
  }

  async findAllForUser(userId: string): Promise<MaintenanceTask[]> {
    this.logger.debug(`findAllForUser: userId=${userId}`);
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
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

  async findById(userId: string, id: string): Promise<MaintenanceTask> {
    this.logger.debug(`findById: userId=${userId}, taskId=${id}`);
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      this.logger.warn(`findById: task not found, id=${id}, error=${error?.message}`);
      throw new NotFoundException('Maintenance task not found');
    }
    return this.mapRow(data);
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
    },
  ): Promise<MaintenanceTask> {
    this.logger.log(
      `create: userId=${userId}, title=${input.title}, motorcycleId=${input.motorcycleId}`,
    );
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
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create maintenance task');
    }
    return this.mapRow(data);
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
    return this.mapRow(data);
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

    const targetMileage =
      completedTask.intervalKm && completedTask.completedMileage
        ? completedTask.completedMileage + completedTask.intervalKm
        : null;

    const { data, error } = await this.adminClient
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

    if (error || !data) return null;
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
  ): Promise<TaskPhoto> {
    this.logger.log(
      `addPhoto: userId=${userId}, taskId=${taskId}, storagePath=${storagePath}, fileSizeBytes=${fileSizeBytes}`,
    );
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
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`addPhoto failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to add photo');
    }
    this.logger.log(`addPhoto success: photoId=${data.id}`);
    return this.mapPhotoRow(data);
  }

  async deletePhoto(userId: string, photoId: string): Promise<boolean> {
    this.logger.log(`deletePhoto: userId=${userId}, photoId=${photoId}`);
    // Fetch photo and validate ownership via task
    const { data: photo, error: photoError } = await this.adminClient
      .from('maintenance_task_photos')
      .select('id, task_id, storage_path')
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

    // Delete from storage using admin client
    const { error: storageError } = await this.adminClient.storage
      .from('maintenance-photos')
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

  async findPhotosByTaskIds(taskIds: string[]): Promise<Map<string, TaskPhoto[]>> {
    this.logger.debug(`findPhotosByTaskIds: ${taskIds.length} task(s)`);
    if (taskIds.length === 0) return new Map();

    const { data, error } = await this.adminClient
      .from('maintenance_task_photos')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');

    const map = new Map<string, TaskPhoto[]>();
    for (const taskId of taskIds) {
      map.set(taskId, []);
    }
    for (const row of data ?? []) {
      const taskId = row.task_id as string;
      const photos = map.get(taskId) ?? [];
      photos.push(this.mapPhotoRow(row));
      map.set(taskId, photos);
    }
    return map;
  }

  private mapPhotoRow(row: Record<string, unknown>): TaskPhoto {
    const storagePath = row.storage_path as string;
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      storagePath,
      publicUrl: `${this.supabaseUrl}/storage/v1/object/public/maintenance-photos/${storagePath}`,
      fileSizeBytes: (row.file_size_bytes as number) ?? undefined,
      mimeType: (row.mime_type as string) ?? 'image/webp',
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
      currency: (row.currency as string) ?? undefined,
      source: (row.source as string) ?? 'user',
      oemScheduleId: (row.oem_schedule_id as string) ?? undefined,
      intervalKm: (row.interval_km as number) ?? undefined,
      intervalDays: (row.interval_days as number) ?? undefined,
      isRecurring: (row.is_recurring as boolean) ?? false,
      photos: [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
