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
import { PG_ERROR } from '../../common/supabase/unwrap';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Motorcycle } from './models/motorcycle.model';
import { type Recall, RecallResult } from './models/recall.model';
import { NhtsaService, type RecallDto } from './nhtsa.service';

const MOTORCYCLE_SELECT =
  'id, user_id, make, model, year, nickname, variant, is_primary, primary_photo_url, current_mileage, mileage_unit, distance_unit, mileage_updated_at, type, engine_cc, purchase_price, purchase_date, vin, recall_count, recall_last_checked_at, odometer_sync_source, odometer_last_ride_id, created_at';

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
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      this.logger.error(`findByUser failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch motorcycles');
    }
    this.logger.debug(`findByUser: found ${data?.length ?? 0} motorcycles`);
    return (data ?? []).map((row) => this.mapRow(row));
  }

  /** Fetches a single owned motorcycle by id, or null if not found / not owned. */
  async findById(userId: string, motorcycleId: string): Promise<Motorcycle | null> {
    this.logger.debug(`findById: userId=${userId}, motorcycleId=${motorcycleId}`);
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select(MOTORCYCLE_SELECT)
      .eq('user_id', userId)
      .eq('id', motorcycleId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      this.logger.error(`findById failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch motorcycle');
    }
    return data ? this.mapRow(data) : null;
  }

  async create(
    userId: string,
    input: { make: string; model: string; year: number; nickname?: string; variant?: string },
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
        variant: input.variant ?? null,
      })
      .select(MOTORCYCLE_SELECT)
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
      variant?: string | null;
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
    if (input.variant !== undefined) updates.variant = input.variant;

    // P2-111: Any manual mileage edit must reset the odometer provenance so
    // the garage UI's "Auto-updated · today" label doesn't lie after a user
    // override. The ride-sync path (endRide) sets these explicitly; here we
    // clear them to 'manual' whenever current_mileage changes.
    if (input.currentMileage != null) {
      updates.odometer_sync_source = 'manual';
      updates.odometer_last_ride_id = null;
      updates.mileage_updated_at = new Date().toISOString();
    }

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
      if (error?.code === PG_ERROR.UNIQUE_VIOLATION && error?.message?.includes('vin')) {
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
    // Since 00176 the RPC answers "is it deleted and yours", so an
    // already-deleted bike returns true and a duplicate tap no longer 400s.
    // `false` now means only "no motorcycle of yours by that id".
    if (data === false) {
      this.logger.warn(`softDelete: no matching motorcycle found for userId=${userId}`);
      throw new BadRequestException('Motorcycle not found');
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
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      this.logger.error('Failed to count user motorcycles for tier check', error);
      throw new InternalServerErrorException('Unable to verify bike limit. Please try again.');
    }

    if ((count ?? 0) >= FREE_TIER_LIMITS.MAX_BIKES) {
      this.logger.warn(
        `User ${userId} hit free tier bike limit: ${count}/${FREE_TIER_LIMITS.MAX_BIKES}`,
      );
      const max = FREE_TIER_LIMITS.MAX_BIKES;
      throw new ForbiddenException(
        `Your free plan includes ${max} motorcycle${max === 1 ? '' : 's'}. Upgrade to Pro for unlimited bikes.`,
      );
    }
  }

  // ==========================================
  // Safety recall check (MOT-142)
  // ==========================================

  async checkRecalls(userId: string, motorcycleId: string): Promise<RecallResult> {
    const { vin, recalls } = await this.loadBikeRecalls(userId, motorcycleId);
    return this.buildRecallResult(userId, motorcycleId, vin, recalls);
  }

  /**
   * Marks one recall campaign as done for the rider's bike (00189). Idempotent:
   * a repeat keeps the original acknowledged_at. Returns the fresh result so the
   * client updates without another query. NHTSA lookups are cached for 24h in
   * NhtsaService, so re-reading the list here is normally a cache hit.
   */
  async acknowledgeRecall(
    userId: string,
    motorcycleId: string,
    campaignNumber: string,
  ): Promise<RecallResult> {
    this.logger.log(
      `acknowledgeRecall: userId=${userId}, motorcycleId=${motorcycleId}, campaign=${campaignNumber}`,
    );
    const { vin, recalls } = await this.loadBikeRecalls(userId, motorcycleId);
    // Only campaigns NHTSA actually lists for this bike can be marked as done.
    if (!recalls.some((recall) => recall.campaignNumber === campaignNumber)) {
      throw new BadRequestException('Recall not found for this motorcycle');
    }

    // User client: the INSERT policy re-checks that the bike is the caller's own
    // live bike. A plain insert (not an upsert) so an existing row — and its
    // acknowledged_at — is left untouched; the unique violation is the no-op.
    const { error } = await this.supabase.from('recall_acknowledgements').insert({
      user_id: userId,
      motorcycle_id: motorcycleId,
      campaign_number: campaignNumber,
    });

    if (error && error.code !== PG_ERROR.UNIQUE_VIOLATION) {
      this.logger.error(`acknowledgeRecall failed: ${error.message} (${error.code})`);
      // RLS rejection or a bike deleted since the read above.
      if (
        error.code === PG_ERROR.INSUFFICIENT_PRIVILEGE ||
        error.code === PG_ERROR.FOREIGN_KEY_VIOLATION
      ) {
        throw new NotFoundException('Motorcycle not found');
      }
      throw new InternalServerErrorException('Failed to mark the recall as done');
    }

    return this.buildRecallResult(userId, motorcycleId, vin, recalls);
  }

  /** Undo of {@link acknowledgeRecall}. Idempotent: deleting a missing row is a no-op. */
  async unacknowledgeRecall(
    userId: string,
    motorcycleId: string,
    campaignNumber: string,
  ): Promise<RecallResult> {
    this.logger.log(
      `unacknowledgeRecall: userId=${userId}, motorcycleId=${motorcycleId}, campaign=${campaignNumber}`,
    );
    const { vin, recalls } = await this.loadBikeRecalls(userId, motorcycleId);

    // Hard delete through the user client: the table has no deleted_at, and the
    // owner-only SELECT/DELETE policies scope it to the caller's own rows.
    const { error } = await this.supabase
      .from('recall_acknowledgements')
      .delete()
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .eq('campaign_number', campaignNumber);

    if (error) {
      this.logger.error(`unacknowledgeRecall failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to reopen the recall');
    }

    return this.buildRecallResult(userId, motorcycleId, vin, recalls);
  }

  /** The owned, live bike's VIN plus the NHTSA recalls for it. 404 when not the caller's. */
  private async loadBikeRecalls(
    userId: string,
    motorcycleId: string,
  ): Promise<{ vin: string | undefined; recalls: RecallDto[] }> {
    const { data: bike, error: bikeError } = await this.supabase
      .from('motorcycles')
      .select(MOTORCYCLE_SELECT)
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .is('deleted_at', null)
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

    return { vin: bike.vin ?? undefined, recalls };
  }

  /**
   * Marks each recall with the rider's acknowledgement, orders open recalls
   * first, and persists recall_count as the OPEN count.
   */
  private async buildRecallResult(
    userId: string,
    motorcycleId: string,
    vin: string | undefined,
    nhtsaRecalls: RecallDto[],
  ): Promise<RecallResult> {
    const { data: acks, error: acksError } = await this.supabase
      .from('recall_acknowledgements')
      .select('campaign_number, acknowledged_at')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId);

    if (acksError) {
      // Failing beats silently counting every recall as open: that would
      // overwrite recall_count with a number the rider already dismissed.
      this.logger.error(
        `buildRecallResult: acknowledgements read failed: ${acksError.message} (${acksError.code})`,
      );
      throw new InternalServerErrorException('Failed to load recall status');
    }

    const acknowledgedAtByCampaign = new Map(
      (acks ?? []).map((ack) => [ack.campaign_number, ack.acknowledged_at] as const),
    );
    const marked: Recall[] = nhtsaRecalls.map((recall) => {
      const acknowledgedAt = acknowledgedAtByCampaign.get(recall.campaignNumber) ?? null;
      return { ...recall, acknowledged: acknowledgedAt !== null, acknowledgedAt };
    });
    const open = marked.filter((recall) => !recall.acknowledged);
    const acknowledged = marked
      .filter((recall) => recall.acknowledged)
      .sort((a, b) => (b.acknowledgedAt ?? '').localeCompare(a.acknowledgedAt ?? ''));

    const checkedAt = new Date().toISOString();

    // Persist the open count so the garage card / plate / CarPlay can show a
    // badge without hitting the NHTSA API on every list render. Admin client is
    // required (recall_* columns are outside the user UPDATE grants), so scope
    // the write to the owned, non-deleted row as defense-in-depth — the bike
    // could be soft-deleted between the read and this write (TOCTOU).
    await this.adminClient
      .from('motorcycles')
      .update({
        recall_count: open.length,
        recall_last_checked_at: checkedAt,
      })
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    return {
      count: open.length,
      acknowledgedCount: acknowledged.length,
      recalls: [...open, ...acknowledged],
      checkedAt,
      vinUsed: vin,
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
      | 'variant'
      | 'is_primary'
      | 'primary_photo_url'
      | 'current_mileage'
      | 'mileage_unit'
      | 'distance_unit'
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
      variant: row.variant ?? undefined,
      isPrimary: row.is_primary,
      primaryPhotoUrl: row.primary_photo_url ?? undefined,
      currentMileage: row.current_mileage ?? undefined,
      mileageUnit: row.mileage_unit ?? undefined,
      distanceUnit: row.distance_unit,
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
