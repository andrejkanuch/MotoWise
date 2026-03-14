import { FREE_TIER_LIMITS } from '@motovault/types';
import type { Tables } from '@motovault/types/database';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Motorcycle } from './models/motorcycle.model';

@Injectable()
export class MotorcyclesService {
  private readonly logger = new Logger(MotorcyclesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
  ) {}

  async findByUser(userId: string): Promise<Motorcycle[]> {
    this.logger.debug(`findByUser: userId=${userId}`);
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select(
        'id, user_id, make, model, year, nickname, is_primary, primary_photo_url, current_mileage, mileage_unit, mileage_updated_at, type, engine_cc, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      this.logger.error(`findByUser failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch motorcycles');
    }
    this.logger.debug(`findByUser: found ${data?.length ?? 0} motorcycles`);
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async create(
    userId: string,
    input: { make: string; model: string; year: number; nickname?: string },
  ): Promise<Motorcycle> {
    this.logger.log(`create: userId=${userId}, make=${input.make}, model=${input.model}`);

    // Enforce free tier bike limit
    await this.enforceFreeTierBikeLimit(userId);

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

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create motorcycle');
    }
    return this.mapRow(data);
  }

  async update(
    userId: string,
    motorcycleId: string,
    input: {
      make?: string;
      model?: string;
      year?: number;
      nickname?: string;
      isPrimary?: boolean;
      primaryPhotoUrl?: string;
      currentMileage?: number;
      mileageUnit?: string;
    },
  ): Promise<Motorcycle> {
    this.logger.log(
      `update: userId=${userId}, motorcycleId=${motorcycleId}, fields=${Object.keys(input).join(',')}`,
    );
    const updates: Record<string, unknown> = {};
    if (input.make != null) updates.make = input.make;
    if (input.model != null) updates.model = input.model;
    if (input.year != null) updates.year = input.year;
    if (input.nickname != null) updates.nickname = input.nickname;
    if (input.isPrimary != null) updates.is_primary = input.isPrimary;
    if (input.primaryPhotoUrl != null) updates.primary_photo_url = input.primaryPhotoUrl;
    if (input.currentMileage != null) updates.current_mileage = input.currentMileage;
    if (input.mileageUnit != null) updates.mileage_unit = input.mileageUnit;

    const { data, error } = await this.supabase
      .from('motorcycles')
      .update(updates)
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`update failed: ${error?.message} (${error?.code}) ${error?.details}`);
      throw new BadRequestException('Failed to update motorcycle');
    }
    return this.mapRow(data);
  }

  async softDelete(userId: string, motorcycleId: string): Promise<boolean> {
    this.logger.log(`softDelete: userId=${userId}, motorcycleId=${motorcycleId}`);
    const { data, error } = await this.supabase.rpc('soft_delete_motorcycle', {
      motorcycle_id: motorcycleId,
    });

    if (error) {
      this.logger.error(`softDelete failed: ${error.message} (${error.code}) ${error.details}`);
      throw new InternalServerErrorException('Failed to delete motorcycle');
    }
    if (data === false) {
      this.logger.warn(`softDelete: no matching motorcycle found for userId=${userId}`);
      throw new BadRequestException('Motorcycle not found or already deleted');
    }
    this.logger.log(`softDelete success: motorcycleId=${motorcycleId}`);
    return true;
  }

  private async enforceFreeTierBikeLimit(userId: string): Promise<void> {
    const { data: userData } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = (userData?.subscription_tier as 'free' | 'pro') ?? 'free';
    if (tier === 'pro') return;

    const { count, error } = await this.supabase
      .from('motorcycles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to count user motorcycles for tier check', error);
      // Fail open — don't block creation if count check fails
      return;
    }

    if ((count ?? 0) >= FREE_TIER_LIMITS.MAX_BIKES) {
      this.logger.warn(
        `User ${userId} hit free tier bike limit: ${count}/${FREE_TIER_LIMITS.MAX_BIKES}`,
      );
      throw new ForbiddenException(
        `Free plan allows up to ${FREE_TIER_LIMITS.MAX_BIKES} motorcycle${FREE_TIER_LIMITS.MAX_BIKES === 1 ? '' : 's'}. Upgrade to Pro for unlimited bikes.`,
      );
    }
  }

  private mapRow(
    row: Pick<
      Tables<'motorcycles'>,
      | 'id'
      | 'user_id'
      | 'make'
      | 'model'
      | 'year'
      | 'nickname'
      | 'is_primary'
      | 'primary_photo_url'
      | 'current_mileage'
      | 'mileage_unit'
      | 'mileage_updated_at'
      | 'type'
      | 'engine_cc'
      | 'created_at'
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
      primaryPhotoUrl: row.primary_photo_url ?? undefined,
      currentMileage: row.current_mileage ?? undefined,
      mileageUnit: row.mileage_unit ?? undefined,
      mileageUpdatedAt: row.mileage_updated_at ?? undefined,
      type: row.type ?? undefined,
      engineCc: row.engine_cc ?? undefined,
      createdAt: row.created_at,
    };
  }
}
