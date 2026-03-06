import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<User> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single();

    if (error || !data) throw new NotFoundException('User not found');
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async update(id: string, input: Partial<{ fullName: string }>): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .update({ full_name: input.fullName })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('User not found');
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
