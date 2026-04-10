import { FREE_TIER_LIMITS } from '@motovault/types';
import type { Tables } from '@motovault/types/database';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Motorcycle } from './models/motorcycle.model';
import { RecallResult } from './models/recall.model';
import { NhtsaService } from './nhtsa.service';

const MOTORCYCLE_SELECT =
  'id, user_id, make, model, year, nickname, is_primary, primary_photo_url, current_mileage, mileage_unit, mileage_updated_at, type, engine_cc, purchase_price, purchase_date, vin, recall_count, recall_last_checked_at, odometer_sync_source, odometer_last_ride_id, created_at';

@Injectable()
export class MotorcyclesService {
  private readonly logger = new Logger(MotorcyclesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly nhtsaService: NhtsaService,
  ) {}

  async findByUser(userId: string): Promise<Motorcycle[]> {
    this.logger.debug(`findByUser: userId=${userId}`);
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select(MOTORCYCLE_SELECT)
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
      purchasePrice?: number | null;
      purchaseDate?: string | null;
      vin?: string | null;
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
    if (input.purchasePrice !== undefined) updates.purchase_price = input.purchasePrice;
    if (input.purchaseDate !== undefined) updates.purchase_date = input.purchaseDate;
    if (input.vin !== undefined) updates.vin = input.vin ? input.vin.toUpperCase() : null;

    const { data, error } = await this.supabase
      .from('motorcycles')
      .update(updates)
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .select(MOTORCYCLE_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(`update failed: ${error?.message} (${error?.code}) ${error?.details}`);
      // P1-106: VIN uniqueness violation — the existing unique index
      // idx_motorcycles_user_vin_active from migration 00005 throws 23505
      // when a user tries to assign the same VIN to two bikes.
      if (error?.code === '23505' && error?.message?.includes('vin')) {
        throw new BadRequestException(
          'That VIN is already registered on another motorcycle in your garage.',
        );
      }
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
      throw new InternalServerErrorException('Unable to verify bike limit. Please try again.');
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

  // ==========================================
  // Safety recall check (MOT-142)
  // ==========================================

  async checkRecalls(userId: string, motorcycleId: string): Promise<RecallResult> {
    const { data: bike, error: bikeError } = await this.supabase
      .from('motorcycles')
      .select(MOTORCYCLE_SELECT)
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .single();

    if (bikeError || !bike) {
      throw new NotFoundException('Motorcycle not found');
    }

    const recalls = await this.nhtsaService.getRecalls({
      vin: bike.vin ?? undefined,
      make: bike.make,
      model: bike.model,
      year: bike.year,
    });

    const checkedAt = new Date().toISOString();

    // Persist the latest count so the garage card can show a badge without
    // hitting the NHTSA API on every list render.
    await this.adminClient
      .from('motorcycles')
      .update({
        recall_count: recalls.length,
        recall_last_checked_at: checkedAt,
      })
      .eq('id', motorcycleId);

    return {
      count: recalls.length,
      recalls,
      checkedAt,
      vinUsed: bike.vin ?? undefined,
    };
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
      | 'purchase_price'
      | 'purchase_date'
      | 'vin'
      | 'recall_count'
      | 'recall_last_checked_at'
      | 'odometer_sync_source'
      | 'odometer_last_ride_id'
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
      purchasePrice: row.purchase_price ? Number(row.purchase_price) : undefined,
      purchaseDate: row.purchase_date ?? undefined,
      vin: row.vin ?? undefined,
      recallCount: row.recall_count ?? undefined,
      recallLastCheckedAt: row.recall_last_checked_at ?? undefined,
      odometerSyncSource: row.odometer_sync_source ?? undefined,
      odometerLastRideId: row.odometer_last_ride_id ?? undefined,
      createdAt: row.created_at,
    };
  }
}
