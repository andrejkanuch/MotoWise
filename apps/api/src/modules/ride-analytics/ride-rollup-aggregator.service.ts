import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RIDE_EVENTS, type RideCompletedEvent } from '../../common/constants/events';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { MIN_RIDE_DISTANCE_M, MIN_RIDE_MOVING_TIME_S } from './ride-analytics.constants';
import { computeMovingTimeS } from './ride-analytics.utils';
import { RideRecordDetector } from './ride-record-detector.service';

@Injectable()
export class RideRollupAggregator {
  private readonly logger = new Logger(RideRollupAggregator.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly recordDetector: RideRecordDetector,
  ) {}

  @OnEvent(RIDE_EVENTS.COMPLETED, { async: true })
  async onRideCompleted(payload: RideCompletedEvent): Promise<void> {
    this.logger.log(`ride.completed event received for ride ${payload.rideId}`);

    try {
      await this.aggregate(payload.rideId, payload.userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Analytics aggregation failed for ride ${payload.rideId}: ${msg}`);
    }
  }

  private async aggregate(rideId: string, userId: string): Promise<void> {
    const { data: ride, error } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, distance_m, max_speed_mps, avg_speed_mps, max_lean_angle, elevation_gain, elevation_loss, started_at, ended_at, paused_duration_s, auto_paused_duration_s, metadata, auto_ended_reason',
      )
      .eq('id', rideId)
      .eq('user_id', userId)
      .single();

    if (error || !ride) {
      this.logger.warn(`Ride ${rideId} not found for analytics: ${error?.message}`);
      return;
    }

    const movingTimeS = computeMovingTimeS(
      ride.started_at,
      ride.ended_at,
      ride.paused_duration_s ?? 0,
      ride.auto_paused_duration_s ?? 0,
    );

    if ((ride.distance_m ?? 0) < MIN_RIDE_DISTANCE_M || movingTimeS < MIN_RIDE_MOVING_TIME_S) {
      this.logger.log(`Ride ${rideId} below real-ride threshold — skipping analytics`);
      return;
    }

    const metadata = (ride.metadata as Record<string, unknown>) ?? {};
    if (metadata.analytics_processed_at) {
      this.logger.log(`Ride ${rideId} already processed — skipping`);
      return;
    }

    // Derive max_lean_angle from waypoints if not set
    if (ride.max_lean_angle == null) {
      const { data: waypointMax } = await this.supabaseAdmin
        .from('ride_waypoints')
        .select('lean_angle')
        .eq('ride_id', rideId)
        .not('lean_angle', 'is', null)
        .order('lean_angle', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (waypointMax?.lean_angle != null) {
        const peakLean = Math.abs(waypointMax.lean_angle);
        await this.supabaseAdmin
          .from('rides')
          .update({ max_lean_angle: peakLean })
          .eq('id', rideId);
        ride.max_lean_angle = peakLean;
      }
    }

    // Call the single-transaction RPC (speed bands set to 0 — computed in Phase 1 when UI exists)
    const rideMetrics = {
      distance_m: ride.distance_m ?? 0,
      moving_time_s: movingTimeS,
      paused_time_s: (ride.paused_duration_s ?? 0) + (ride.auto_paused_duration_s ?? 0),
      elevation_gain_m: ride.elevation_gain ?? 0,
      elevation_loss_m: ride.elevation_loss ?? 0,
      max_speed_mps: ride.max_speed_mps ?? null,
      max_lean_angle: ride.max_lean_angle ?? null,
      band_urban_s: 0,
      band_cruise_s: 0,
      band_spirited_s: 0,
      band_silly_s: 0,
    };

    const { error: rpcError } = await this.supabaseAdmin.rpc('record_ride_analytics', {
      p_ride_id: rideId,
      p_user_id: userId,
      p_motorcycle_id: ride.motorcycle_id,
      p_started_at: ride.started_at,
      p_ride_metrics: rideMetrics,
    });

    if (rpcError) {
      this.logger.error(`record_ride_analytics RPC failed: ${rpcError.message}`);
      throw new Error(`RPC failed: ${rpcError.message}`);
    }

    this.logger.log(`Analytics recorded for ride ${rideId}`);

    // A system-ended ride still counts toward ROLLUPS above — the rider really did
    // cover that distance, and dropping it would understate their totals. But it must
    // never set a PERSONAL BEST: its GPS track is partial by definition (the sweep
    // only ends rides that stopped reporting), so "longest distance" or "top speed"
    // derived from it is unverifiable, and a forgotten ride claiming a record is
    // exactly the kind of thing a rider can never undo. (Migration 00173.)
    if (ride.auto_ended_reason) {
      this.logger.log(
        `Ride ${rideId} was system-ended (${ride.auto_ended_reason}) — skipping record detection`,
      );
      return;
    }

    // Detect records (after the transaction commits, idempotent via unique constraint)
    await this.recordDetector.detect(userId, {
      id: ride.id,
      user_id: ride.user_id,
      motorcycle_id: ride.motorcycle_id,
      distance_m: ride.distance_m ?? 0,
      max_speed_mps: ride.max_speed_mps,
      max_lean_angle: ride.max_lean_angle,
      elevation_gain: ride.elevation_gain,
      started_at: ride.started_at,
      ended_at: ride.ended_at,
      paused_duration_s: ride.paused_duration_s ?? 0,
      auto_paused_duration_s: ride.auto_paused_duration_s ?? 0,
    });
  }
}
