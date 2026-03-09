import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { ShareLink } from './models/share-link.model';
import { SharedBikeHistory } from './models/shared-bike-history.model';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const SHARE_BASE_URL = 'https://motowise.app/share';

@Injectable()
export class ShareLinksService {
  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async create(userId: string, motorcycleId: string, expiresInDays: number): Promise<ShareLink> {
    // Verify motorcycle ownership
    const { data: bike, error: bikeError } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .single();

    if (bikeError || !bike) {
      throw new ForbiddenException('Motorcycle not found or not owned by user');
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('share_links')
      .insert({
        user_id: userId,
        motorcycle_id: motorcycleId,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to create share link');
    }

    return this.mapRow(data);
  }

  async revoke(userId: string, linkId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select('id')
      .single();

    if (error || !data) {
      throw new NotFoundException('Share link not found');
    }

    return true;
  }

  async resolve(token: string): Promise<SharedBikeHistory> {
    if (!TOKEN_PATTERN.test(token)) {
      throw new BadRequestException('Invalid share token');
    }

    // Use admin client to bypass RLS for public resolution
    const { data: link, error: linkError } = await this.supabaseAdmin
      .from('share_links')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .is('revoked_at', null)
      .single();

    if (linkError || !link) {
      throw new NotFoundException('Share link not found, expired, or revoked');
    }

    const motorcycleId = link.motorcycle_id as string;

    // Fetch motorcycle details
    const { data: bike, error: bikeError } = await this.supabaseAdmin
      .from('motorcycles')
      .select('make, model, year, nickname')
      .eq('id', motorcycleId)
      .single();

    if (bikeError || !bike) {
      throw new NotFoundException('Motorcycle not found');
    }

    // Fetch all maintenance tasks (including completed, excluding soft-deleted)
    const { data: tasksWithIds, error: tasksError } = await this.supabaseAdmin
      .from('maintenance_tasks')
      .select('id, title, status, priority, due_date, completed_at, completed_mileage, notes')
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (tasksError) {
      throw new InternalServerErrorException('Failed to fetch maintenance tasks');
    }

    const taskIds = (tasksWithIds ?? []).map((t) => t.id as string);

    // Fetch photos for all tasks
    const photosByTask: Record<string, string[]> = {};
    if (taskIds.length > 0) {
      const { data: photos } = await this.supabaseAdmin
        .from('maintenance_task_photos')
        .select('task_id, storage_path')
        .in('task_id', taskIds);

      if (photos) {
        for (const photo of photos) {
          const taskId = photo.task_id as string;
          const storagePath = photo.storage_path as string;
          if (!photosByTask[taskId]) photosByTask[taskId] = [];
          const { data: urlData } = this.supabaseAdmin.storage
            .from('maintenance-photos')
            .getPublicUrl(storagePath);
          photosByTask[taskId].push(urlData.publicUrl);
        }
      }
    }

    return {
      bike: {
        make: bike.make as string,
        model: bike.model as string,
        year: bike.year as number,
        nickname: (bike.nickname as string) ?? undefined,
      },
      tasks: (tasksWithIds ?? []).map((task) => ({
        title: task.title as string,
        status: task.status as string,
        priority: task.priority as string,
        dueDate: (task.due_date as string) ?? undefined,
        completedAt: (task.completed_at as string) ?? undefined,
        completedMileage: (task.completed_mileage as number) ?? undefined,
        notes: (task.notes as string) ?? undefined,
        photoUrls: photosByTask[task.id as string] ?? [],
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async findByMotorcycle(userId: string, motorcycleId: string): Promise<ShareLink[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('share_links')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch share links');
    }

    return (data ?? []).map((row) => this.mapRow(row));
  }

  private mapRow(row: Record<string, unknown>): ShareLink {
    const token = row.token as string;
    return {
      id: row.id as string,
      token,
      motorcycleId: row.motorcycle_id as string,
      expiresAt: row.expires_at as string,
      createdAt: row.created_at as string,
      url: `${SHARE_BASE_URL}/${token}`,
    };
  }
}
