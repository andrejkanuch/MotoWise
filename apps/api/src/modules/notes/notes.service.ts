import { MaintenancePriority, NOTE_PHOTOS_MAX } from '@motovault/types';
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
import { PHOTO_BUCKETS } from '../../common/storage/photo-storage';
import { MaintenanceTasksService } from '../maintenance-tasks/maintenance-tasks.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { CreateNoteInput } from './dto/create-note.input';
import type { UpdateNoteInput } from './dto/update-note.input';
import type { Note } from './models/note.model';
import type { NotePhoto } from './models/note-photo.model';
import { deriveTaskTitleFromNote } from './note-task-title';

const NOTES_TABLE = 'notes';
const NOTE_PHOTOS_TABLE = 'note_photos';
const SOFT_DELETE_NOTE_RPC = 'soft_delete_note';

/**
 * One select for the note and both links. The embeds run under the caller's RLS,
 * so a soft-deleted task or expense comes back as null while the id column
 * stays — which is exactly "linked, but the target is gone".
 */
const NOTE_SELECT =
  'id, user_id, motorcycle_id, body, odometer, linked_task_id, linked_expense_id, created_at, updated_at, linked_task:maintenance_tasks!linked_task_id(title), linked_expense:expenses!linked_expense_id(amount, currency)';
const NOTE_PHOTO_SELECT =
  'id, note_id, user_id, storage_path, file_size_bytes, mime_type, created_at';

/** `maintenance_tasks.notes` is capped at 2000 by the task Zod schemas; a longer
 *  copy would make the created task impossible to edit. */
const TASK_NOTES_MAX = 2000;

const DEFAULT_PHOTO_MIME_TYPE = 'image/webp';
const PHOTO_MIME_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

interface NoteRow {
  id: string;
  user_id: string;
  motorcycle_id: string;
  body: string;
  odometer: number | null;
  linked_task_id: string | null;
  linked_expense_id: string | null;
  created_at: string;
  updated_at: string;
  linked_task: { title: string } | null;
  linked_expense: { amount: number | string; currency: string } | null;
}

interface NotePhotoRow {
  id: string;
  note_id: string;
  user_id: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

/**
 * Per-bike notes (00182). Everything goes through the per-request user client,
 * so RLS is the ownership check; the admin client is used for one thing only —
 * removing a photo's storage object. No entitlement check: logging is free.
 */
@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);
  private readonly supabaseUrl: string;

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly maintenanceTasksService: MaintenanceTasksService,
  ) {
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
  }

  /** Newest first, unpaginated (personal notes; revisit past ~200 per bike). */
  async findByMotorcycle(userId: string, motorcycleId: string): Promise<Note[]> {
    const { data, error } = await this.supabase
      .from(NOTES_TABLE)
      .select(NOTE_SELECT)
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`findByMotorcycle failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch notes');
    }
    return ((data ?? []) as unknown as NoteRow[]).map((row) => this.mapRow(row));
  }

  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    this.logger.log(`create: userId=${userId}, motorcycleId=${input.motorcycleId}`);
    const { data, error } = await this.supabase
      .from(NOTES_TABLE)
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId,
        body: input.text,
        odometer: input.odometer ?? null,
      })
      .select(NOTE_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create note');
    }

    const row = data as unknown as NoteRow;
    if (!input.alsoCreateTask) return this.mapRow(row);

    // The note is saved; a failed task must not turn that into an error the
    // rider would answer by saving the same note twice. The note comes back
    // unlinked and "Make it a task" stays available.
    try {
      return await this.linkNewTask(userId, row);
    } catch (taskError) {
      this.logger.warn(
        `create: note ${row.id} saved but its task was not created: ${(taskError as Error).message}`,
      );
      return this.mapRow(row);
    }
  }

  async update(userId: string, noteId: string, input: UpdateNoteInput): Promise<Note> {
    this.logger.log(`update: userId=${userId}, noteId=${noteId}`);
    const updates: Record<string, unknown> = {};
    if (input.text != null) updates.body = input.text;
    if (input.odometer !== undefined) updates.odometer = input.odometer;
    if (Object.keys(updates).length === 0) return this.mapRow(await this.findRow(userId, noteId));

    const { data, error } = await this.supabase
      .from(NOTES_TABLE)
      .update(updates)
      .eq('id', noteId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select(NOTE_SELECT)
      .maybeSingle();

    if (error) {
      this.logger.error(`update failed: ${error.message} (${error.code})`);
      throw new BadRequestException('Failed to update note');
    }
    if (!data) throw new NotFoundException('Note not found');
    return this.mapRow(data as unknown as NoteRow);
  }

  /** Idempotent: `true` for an own note, deleted now or earlier (00176 contract). */
  async softDelete(userId: string, noteId: string): Promise<boolean> {
    this.logger.log(`softDelete: userId=${userId}, noteId=${noteId}`);
    const { data, error } = await this.supabase.rpc(SOFT_DELETE_NOTE_RPC, { note_id: noteId });

    if (error) {
      this.logger.error(`softDelete failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to delete note');
    }
    if (data !== true) throw new NotFoundException('Note not found');
    return true;
  }

  /**
   * "Make it a task" for an existing note. Idempotent: a note whose linked task
   * is still live comes back unchanged. A link to a deleted task is replaced.
   */
  async createTaskFromNote(userId: string, noteId: string): Promise<Note> {
    const row = await this.findRow(userId, noteId);
    if (row.linked_task_id && row.linked_task) return this.mapRow(row);
    return this.linkNewTask(userId, row);
  }

  async addPhoto(
    userId: string,
    noteId: string,
    storagePath: string,
    fileSizeBytes?: number,
  ): Promise<NotePhoto> {
    this.logger.log(`addPhoto: userId=${userId}, noteId=${noteId}`);

    // Server-side prefix check: stops a caller registering someone else's object
    // as their own photo and then deleting it through deletePhoto's admin client.
    if (!storagePath.startsWith(`${userId}/notes/${noteId}/`)) {
      this.logger.warn(`addPhoto: rejected storage path outside the note prefix. userId=${userId}`);
      throw new BadRequestException('Invalid storage path');
    }

    await this.findRow(userId, noteId);

    const { count, error: countError } = await this.supabase
      .from(NOTE_PHOTOS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('note_id', noteId);

    if (countError) throw new InternalServerErrorException('Failed to check photo count');
    if ((count ?? 0) >= NOTE_PHOTOS_MAX) {
      throw new BadRequestException(`Maximum of ${NOTE_PHOTOS_MAX} photos per note`);
    }

    const extension = storagePath.split('.').pop()?.toLowerCase() ?? '';
    const { data, error } = await this.supabase
      .from(NOTE_PHOTOS_TABLE)
      .insert({
        note_id: noteId,
        user_id: userId,
        storage_path: storagePath,
        file_size_bytes: fileSizeBytes ?? null,
        mime_type: PHOTO_MIME_TYPES[extension] ?? DEFAULT_PHOTO_MIME_TYPE,
      })
      .select(NOTE_PHOTO_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(`addPhoto failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to add photo');
    }
    return this.mapPhotoRow(data as NotePhotoRow);
  }

  async deletePhoto(userId: string, photoId: string): Promise<boolean> {
    this.logger.log(`deletePhoto: userId=${userId}, photoId=${photoId}`);
    const { data: photo, error: photoError } = await this.supabase
      .from(NOTE_PHOTOS_TABLE)
      .select(NOTE_PHOTO_SELECT)
      .eq('id', photoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (photoError || !photo) throw new NotFoundException('Photo not found');
    const row = photo as NotePhotoRow;

    // Defence in depth before the path reaches the admin client's storage.remove.
    if (!row.storage_path.startsWith(`${userId}/`)) {
      this.logger.warn(`deletePhoto: rejected path outside the user prefix. userId=${userId}`);
      throw new NotFoundException('Photo not found');
    }

    const { error: storageError } = await this.adminClient.storage
      .from(PHOTO_BUCKETS.MAINTENANCE_PHOTOS)
      .remove([row.storage_path]);
    if (storageError) {
      // Logged, not fatal: removing the link row matters more than the object.
      this.logger.warn(`deletePhoto: storage deletion failed: ${storageError.message}`);
    }

    const { error: deleteError } = await this.supabase
      .from(NOTE_PHOTOS_TABLE)
      .delete()
      .eq('id', photoId)
      .eq('user_id', userId);

    if (deleteError) throw new InternalServerErrorException('Failed to delete photo');
    return true;
  }

  /** Batched photo lookup for the request-scoped DataLoader. RLS scopes it to the caller. */
  async findPhotosByNoteIds(noteIds: string[]): Promise<Map<string, NotePhoto[]>> {
    const map = new Map<string, NotePhoto[]>(noteIds.map((id) => [id, []]));
    if (noteIds.length === 0) return map;

    const { data, error } = await this.supabase
      .from(NOTE_PHOTOS_TABLE)
      .select(NOTE_PHOTO_SELECT)
      .in('note_id', noteIds)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');

    for (const row of (data ?? []) as NotePhotoRow[]) {
      map.get(row.note_id)?.push(this.mapPhotoRow(row));
    }
    return map;
  }

  /** Creates the low-priority, undated task for a note and stores the link. */
  private async linkNewTask(userId: string, row: NoteRow): Promise<Note> {
    const task = await this.maintenanceTasksService.create(userId, {
      motorcycleId: row.motorcycle_id,
      title: deriveTaskTitleFromNote(row.body),
      priority: MaintenancePriority.LOW,
      notes: row.body.slice(0, TASK_NOTES_MAX),
    });

    const { data, error } = await this.supabase
      .from(NOTES_TABLE)
      .update({ linked_task_id: task.id })
      .eq('id', row.id)
      .eq('user_id', userId)
      .select(NOTE_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(`linkNewTask failed: ${error?.message} (${error?.code})`);
      throw new InternalServerErrorException('Failed to link the task to the note');
    }
    return this.mapRow(data as unknown as NoteRow);
  }

  private async findRow(userId: string, noteId: string): Promise<NoteRow> {
    const { data, error } = await this.supabase
      .from(NOTES_TABLE)
      .select(NOTE_SELECT)
      .eq('id', noteId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      this.logger.error(`findRow failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch note');
    }
    if (!data) throw new NotFoundException('Note not found');
    return data as unknown as NoteRow;
  }

  private mapRow(row: NoteRow): Note {
    return {
      id: row.id,
      motorcycleId: row.motorcycle_id,
      text: row.body,
      odometer: row.odometer ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      linkedTaskId: row.linked_task_id ?? undefined,
      linkedTaskTitle: row.linked_task?.title ?? undefined,
      linkedExpenseId: row.linked_expense_id ?? undefined,
      linkedExpenseAmount: row.linked_expense ? Number(row.linked_expense.amount) : undefined,
      linkedExpenseCurrency: row.linked_expense?.currency ?? undefined,
    };
  }

  private mapPhotoRow(row: NotePhotoRow): NotePhoto {
    return {
      id: row.id,
      noteId: row.note_id,
      storagePath: row.storage_path,
      publicUrl: `${this.supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKETS.MAINTENANCE_PHOTOS}/${row.storage_path}`,
      fileSizeBytes: row.file_size_bytes ?? undefined,
      mimeType: row.mime_type ?? DEFAULT_PHOTO_MIME_TYPE,
      createdAt: row.created_at,
    };
  }
}
