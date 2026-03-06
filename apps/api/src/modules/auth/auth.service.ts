import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { User } from '../users/models/user.model';

@Injectable()
export class AuthService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async getProfile(userId: string): Promise<User> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', userId).single();

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
