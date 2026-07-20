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
} from '../../../common/storage/photo-storage';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { TaskPhoto } from '../models/task-photo.model';

const MAINTENANCE_TASK_PHOTOS_TABLE = 'maintenance_task_photos';
const MAINTENANCE_TASKS_TABLE = 'maintenance_tasks';
const MAX_PHOTOS_PER_TASK = 5;

/**
 * Maintenance-task photo attachments (gallery + U7a receipts). Split out of the
 * monolithic MaintenanceTasksService (services/ shape, mirrors trips/).
 */
@Injectable()
export class MaintenanceTaskPhotosService {
  private readonly logger = new Logger(MaintenanceTaskPhotosService.name);
  private readonly supabaseUrl: string;

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
  }

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
      .from(MAINTENANCE_TASKS_TABLE)
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
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
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
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
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
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
      .select('id, task_id, storage_path, bucket, user_id')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) throw new NotFoundException('Photo not found');

    // Validate task ownership
    const { data: task, error: taskError } = await this.adminClient
      .from(MAINTENANCE_TASKS_TABLE)
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
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
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
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
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
   * Removes the storage OBJECTS + link rows for any receipts-bucket photos
   * attached to a task. Best-effort (logs, never throws). Called by the CRUD
   * service on soft-delete.
   */
  async purgeReceiptsPhotos(userId: string, taskId: string): Promise<void> {
    const { data, error } = await this.adminClient
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
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
      .from(MAINTENANCE_TASK_PHOTOS_TABLE)
      .delete()
      .in('id', idsToUnlink);
    if (linkError) {
      this.logger.warn(`purgeReceiptsPhotos: link-row delete failed: ${linkError.message}`);
    }
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
}
