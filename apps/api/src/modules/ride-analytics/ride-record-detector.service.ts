import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { ALL_BIKES_SENTINEL } from './ride-analytics.constants';
import { computeMovingTimeS } from './ride-analytics.utils';

export interface RideRow {
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
   * Check 4 record types against current bests. Idempotent via unique constraint.
   * First-ride edge case: creates the record but sets previous_value = NULL.
   * Candidates are checked in parallel (different record_type values, no conflict).
   */
  async detect(userId: string, ride: RideRow): Promise<void> {
    const movingTimeS = computeMovingTimeS(
      ride.started_at,
      ride.ended_at,
      ride.paused_duration_s,
      ride.auto_paused_duration_s,
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

    // Parallelize — each candidate targets a different record_type, no conflict
    await Promise.all(
      candidates.map((candidate) => this.upsertIfRecord(userId, candidate, ride.ended_at)),
    );
  }

  private async upsertIfRecord(
    userId: string,
    candidate: RecordCandidate,
    achievedAt: string,
  ): Promise<void> {
    const { data: existing } = await this.supabaseAdmin
      .from('ride_records')
      .select('id, value')
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL)
      .eq('record_type', candidate.recordType)
      .maybeSingle();

    if (existing) {
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

      if (error && error.code !== PG_ERROR.UNIQUE_VIOLATION) {
        this.logger.warn(`Failed to insert record ${candidate.recordType}: ${error.message}`);
      } else if (!error) {
        this.logger.log(`First record set: ${candidate.recordType} = ${candidate.value}`);
      }
    }
  }
}
