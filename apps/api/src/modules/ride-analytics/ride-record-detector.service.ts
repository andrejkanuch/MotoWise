import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { ALL_BIKES_SENTINEL } from './ride-analytics.constants';

interface RideRow {
  id: string;
  user_id: string;
  motorcycle_id: string | null;
  distance_m: number;
  max_speed_mps: number | null;
  max_lean_angle: number | null;
  elevation_gain: number | null;
  started_at: string;
  ended_at: string;
  paused_duration_s: number;
  auto_paused_duration_s: number;
}

interface RecordCandidate {
  recordType: string;
  value: number;
  unit: string;
  rideId: string;
}

@Injectable()
export class RideRecordDetector {
  private readonly logger = new Logger(RideRecordDetector.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient) {}

  /**
   * Check 5 record types against current bests. Idempotent via unique constraint.
   * First-ride edge case: creates the record but sets previous_value = NULL.
   */
  async detect(userId: string, ride: RideRow): Promise<void> {
    const movingTimeS = Math.max(
      0,
      Math.floor((new Date(ride.ended_at).getTime() - new Date(ride.started_at).getTime()) / 1000) -
        (ride.paused_duration_s ?? 0) -
        (ride.auto_paused_duration_s ?? 0),
    );

    const candidates: RecordCandidate[] = [
      { recordType: 'longest_distance', value: ride.distance_m, unit: 'm', rideId: ride.id },
      { recordType: 'longest_duration', value: movingTimeS, unit: 's', rideId: ride.id },
    ];

    if (ride.max_speed_mps != null) {
      candidates.push({
        recordType: 'top_speed',
        value: ride.max_speed_mps,
        unit: 'mps',
        rideId: ride.id,
      });
    }

    if (ride.elevation_gain != null) {
      candidates.push({
        recordType: 'max_elevation_gain',
        value: ride.elevation_gain,
        unit: 'm',
        rideId: ride.id,
      });
    }

    for (const candidate of candidates) {
      await this.upsertIfRecord(userId, candidate, ride.ended_at);
    }
  }

  /**
   * Re-elect records for a user after a ride is deleted.
   * Scans remaining rides and overwrites the current record.
   */
  async reelectRecords(userId: string, motorcycleId: string | null): Promise<void> {
    const bikeId = motorcycleId ?? ALL_BIKES_SENTINEL;
    this.logger.log(`Re-electing records for user=${userId}, bike=${bikeId}`);

    // Delete records for sentinel; they'll be re-created from remaining rides
    await this.supabaseAdmin
      .from('ride_records')
      .delete()
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL);

    // Fetch all real rides for this user
    const { data: rides } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, distance_m, max_speed_mps, max_lean_angle, elevation_gain, started_at, ended_at, paused_duration_s, auto_paused_duration_s',
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .gte('distance_m', 500);

    if (!rides?.length) return;

    // Re-detect records from remaining rides (oldest first so latest wins)
    const sorted = rides.sort(
      (a, b) => new Date(a.ended_at).getTime() - new Date(b.ended_at).getTime(),
    );
    for (const ride of sorted) {
      await this.detect(userId, ride as RideRow);
    }
  }

  private async upsertIfRecord(
    userId: string,
    candidate: RecordCandidate,
    achievedAt: string,
  ): Promise<void> {
    // Fetch current record
    const { data: existing } = await this.supabaseAdmin
      .from('ride_records')
      .select('id, value')
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL)
      .eq('record_type', candidate.recordType)
      .maybeSingle();

    if (existing) {
      // Only update if new value beats the current record
      if (candidate.value <= existing.value) return;

      await this.supabaseAdmin
        .from('ride_records')
        .update({
          value: candidate.value,
          unit: candidate.unit,
          ride_id: candidate.rideId,
          achieved_at: achievedAt,
          previous_value: existing.value,
        })
        .eq('id', existing.id);

      this.logger.log(
        `Record updated: ${candidate.recordType} = ${candidate.value} (was ${existing.value})`,
      );
    } else {
      // First record — previous_value is NULL (no PB toast for first-ever)
      const { error } = await this.supabaseAdmin.from('ride_records').insert({
        user_id: userId,
        motorcycle_id: ALL_BIKES_SENTINEL,
        record_type: candidate.recordType,
        value: candidate.value,
        unit: candidate.unit,
        ride_id: candidate.rideId,
        achieved_at: achievedAt,
        previous_value: null,
      });

      if (error) {
        // ON CONFLICT DO NOTHING — another process may have inserted
        if (error.code !== '23505') {
          this.logger.warn(`Failed to insert record ${candidate.recordType}: ${error.message}`);
        }
      } else {
        this.logger.log(`First record set: ${candidate.recordType} = ${candidate.value}`);
      }
    }
  }
}
