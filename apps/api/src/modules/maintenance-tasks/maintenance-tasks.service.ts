import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { MaintenanceTask } from './models/maintenance-task.model';

@Injectable()
export class MaintenanceTasksService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByMotorcycle(userId: string, motorcycleId: string): Promise<MaintenanceTask[]> {
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('status', { ascending: true })
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw new InternalServerErrorException('Failed to fetch maintenance tasks');
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async findById(userId: string, id: string): Promise<MaintenanceTask> {
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Maintenance task not found');
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

    if (error || !data) throw new BadRequestException('Failed to create maintenance task');
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

    if (error || !data) throw new BadRequestException('Failed to update maintenance task');
    return this.mapRow(data);
  }

  async complete(userId: string, id: string, completedMileage?: number): Promise<MaintenanceTask> {
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_mileage: completedMileage,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) throw new BadRequestException('Failed to complete maintenance task');
    return this.mapRow(data);
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('maintenance_tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error || !data) throw new NotFoundException('Maintenance task not found');
    return true;
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
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
