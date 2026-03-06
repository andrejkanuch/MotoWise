import type { Tables } from '@motolearn/types/database';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Motorcycle } from './models/motorcycle.model';

@Injectable()
export class MotorcyclesService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByUser(userId: string): Promise<Motorcycle[]> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('id, user_id, make, model, year, nickname, is_primary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new InternalServerErrorException('Failed to fetch motorcycles');
    return (data ?? []).map((row) => this.mapRow(row));
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

  async softDelete(userId: string, motorcycleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('motorcycles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', motorcycleId)
      .eq('user_id', userId);

    if (error) throw new InternalServerErrorException('Failed to delete motorcycle');
  }

  private mapRow(
    row: Pick<
      Tables<'motorcycles'>,
      'id' | 'user_id' | 'make' | 'model' | 'year' | 'nickname' | 'is_primary' | 'created_at'
    >,
  ): Motorcycle {
    return {
      id: row.id,
      userId: row.user_id,
      make: row.make,
      model: row.model,
      year: row.year,
      nickname: row.nickname ?? undefined,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
    };
  }
}
