import { UserPreferencesSchema } from '@motolearn/types';
import type { Tables } from '@motolearn/types/database';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  private mapRow(row: Tables<'users'>): User {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? undefined,
      role: row.role,
      preferences: (row.preferences as Record<string, unknown>) ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string): Promise<User> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single();

    if (error || !data) throw new NotFoundException('User not found');
    return this.mapRow(data);
  }

  async update(
    id: string,
    input: Partial<{
      fullName: string;
      avatarUrl: string;
      yearsRiding: number;
      preferences: Record<string, unknown>;
    }>,
  ): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.yearsRiding !== undefined) payload.years_riding = input.yearsRiding;

    if (input.preferences) {
      const validatedPrefs = UserPreferencesSchema.parse(input.preferences);

      const { data: current } = await this.supabase
        .from('users')
        .select('preferences')
        .eq('id', id)
        .single();

      payload.preferences = {
        ...((current?.preferences as object) ?? {}),
        ...validatedPrefs,
      };
    }

    const { data, error } = await this.supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new BadRequestException(error?.message ?? 'Failed to update user');
    return this.mapRow(data);
  }
}
