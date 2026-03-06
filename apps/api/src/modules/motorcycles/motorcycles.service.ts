import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Motorcycle } from './models/motorcycle.model';

@Injectable()
export class MotorcyclesService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByUser(userId: string): Promise<Motorcycle[]> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(this.mapRow);
  }

  async create(
    userId: string,
    input: { make: string; model: string; year: number; nickname?: string },
  ): Promise<Motorcycle> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .insert({
        user_id: userId,
        make: input.make,
        model: input.model,
        year: input.year,
        nickname: input.nickname,
      })
      .select()
      .single();

    if (error || !data) throw new BadRequestException('Failed to create motorcycle');
    return this.mapRow(data);
  }

  private mapRow(row: any): Motorcycle {
    return {
      id: row.id,
      userId: row.user_id,
      make: row.make,
      model: row.model,
      year: row.year,
      nickname: row.nickname,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
    };
  }
}
