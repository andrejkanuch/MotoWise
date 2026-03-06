import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  private mapRow(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      fullName: row.full_name as string,
      role: row.role as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async findById(id: string): Promise<User> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single();

    if (error || !data) throw new NotFoundException('User not found');
    return this.mapRow(data);
  }

  async update(id: string, input: Partial<{ fullName: string }>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ full_name: input.fullName })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('User not found');
    return this.mapRow(data);
  }
}
