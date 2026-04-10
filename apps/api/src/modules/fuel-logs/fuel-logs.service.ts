import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { FuelLog } from './models/fuel-log.model';

const LITRES_PER_US_GALLON = 3.785411784;
const KM_PER_MILE = 1.609344;

interface FuelLogRow {
  id: string;
  motorcycle_id: string;
  user_id: string;
  odometer_km: number | string;
  fuel_litres: number | string;
  total_cost: number | string | null;
  currency: string | null;
  fuel_type: string | null;
  is_partial: boolean;
  notes: string | null;
  filled_at: string;
  created_at: string;
  deleted_at: string | null;
}

@Injectable()
export class FuelLogsService {
  private readonly logger = new Logger(FuelLogsService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  /**
   * Fetch all non-deleted fuel logs for a motorcycle, most recent first.
   * Each log is augmented with economy metrics calculated from the
   * previous (non-partial) fill-up.
   */
  async listByMotorcycle(userId: string, motorcycleId: string): Promise<FuelLog[]> {
    const { data, error } = await this.supabase
      .from('fuel_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('filled_at', { ascending: false });

    if (error) {
      this.logger.error(`listByMotorcycle failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch fuel logs');
    }

    return this.attachEconomy((data ?? []) as FuelLogRow[]);
  }

  /**
   * Create a new fuel log and auto-create a matching expense in the 'fuel' category.
   * The expense/fuel log are NOT in a transaction — if expense creation fails we
   * keep the fuel log (primary record) and log the error.
   */
  async create(
    userId: string,
    input: {
      motorcycleId: string;
      odometerKm: number;
      fuelLitres: number;
      totalCost?: number;
      currency?: string;
      fuelType?: string;
      isPartial?: boolean;
      notes?: string;
      filledAt?: string;
    },
  ): Promise<FuelLog> {
    this.logger.log(
      `create: userId=${userId}, motorcycleId=${input.motorcycleId}, odo=${input.odometerKm}, litres=${input.fuelLitres}`,
    );

    // Verify motorcycle ownership via RLS-respecting select
    const { data: bike } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('id', input.motorcycleId)
      .eq('user_id', userId)
      .single();

    if (!bike) {
      throw new NotFoundException('Motorcycle not found');
    }

    const { data, error } = await this.supabase
      .from('fuel_logs')
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId,
        odometer_km: input.odometerKm,
        fuel_litres: input.fuelLitres,
        total_cost: input.totalCost ?? null,
        currency: input.currency ?? 'USD',
        fuel_type: input.fuelType ?? 'regular',
        is_partial: input.isPartial ?? false,
        notes: input.notes ?? null,
        filled_at: input.filledAt ?? new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create fuel log');
    }

    // Auto-create an expense entry so the dashboard reflects fuel spend
    // without requiring a second manual step. Non-fatal — if the expense
    // insert fails, the fuel log still succeeds.
    if (input.totalCost != null && input.totalCost > 0) {
      try {
        const dateOnly = (input.filledAt ?? new Date().toISOString()).slice(0, 10);
        await this.supabase.from('expenses').insert({
          user_id: userId,
          motorcycle_id: input.motorcycleId,
          amount: input.totalCost,
          category: 'fuel',
          date: dateOnly,
          description: input.notes ?? `${input.fuelLitres}L ${input.fuelType ?? 'regular'} fill-up`,
          currency: input.currency ?? 'USD',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Auto-expense for fuel_log failed: ${msg}`);
      }
    }

    // Return the new log with economy attached (last element — single-item list)
    const all = await this.listByMotorcycle(userId, input.motorcycleId);
    const created = all.find((log) => log.id === (data as FuelLogRow).id);
    return created ?? this.attachEconomy([data as FuelLogRow])[0];
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('fuel_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(`softDelete failed: ${error?.message}`);
      throw new BadRequestException('Failed to delete fuel log');
    }
    return true;
  }

  /**
   * Walk the fill-up list (oldest → newest) and attach economy metrics
   * to every non-partial log. Partial fill-ups are included in the list
   * but have null economy values — the next full fill-up uses the last
   * full fill-up as its reference point.
   */
  private attachEconomy(rows: FuelLogRow[]): FuelLog[] {
    // rows come back DESC — reverse to walk oldest-first
    const oldestFirst = [...rows].reverse();
    const mapped: FuelLog[] = [];
    let lastFullIndex = -1;

    for (let i = 0; i < oldestFirst.length; i++) {
      const row = oldestFirst[i];
      const log = this.mapRow(row);

      if (lastFullIndex >= 0 && !row.is_partial) {
        const prev = oldestFirst[lastFullIndex];
        const distanceKm = Number(row.odometer_km) - Number(prev.odometer_km);
        // Sum litres for every fill-up between the two full readings
        let litresSum = 0;
        for (let j = lastFullIndex + 1; j <= i; j++) {
          litresSum += Number(oldestFirst[j].fuel_litres);
        }

        if (distanceKm > 0 && litresSum > 0) {
          log.kmSincePrevious = distanceKm;
          log.litresPer100Km = (litresSum / distanceKm) * 100;
          // US MPG: miles / US gallons
          const miles = distanceKm / KM_PER_MILE;
          const usGallons = litresSum / LITRES_PER_US_GALLON;
          log.mpgUs = miles / usGallons;
        }
      }

      if (!row.is_partial) lastFullIndex = i;
      mapped.push(log);
    }

    // Reverse back to newest-first for the client
    return mapped.reverse();
  }

  private mapRow(row: FuelLogRow): FuelLog {
    return {
      id: row.id,
      motorcycleId: row.motorcycle_id,
      odometerKm: Number(row.odometer_km),
      fuelLitres: Number(row.fuel_litres),
      totalCost: row.total_cost != null ? Number(row.total_cost) : undefined,
      currency: row.currency ?? 'USD',
      fuelType: row.fuel_type ?? 'regular',
      isPartial: row.is_partial,
      notes: row.notes ?? undefined,
      filledAt: row.filled_at,
      createdAt: row.created_at,
    };
  }
}
