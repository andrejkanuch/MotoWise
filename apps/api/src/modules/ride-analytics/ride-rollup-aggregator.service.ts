import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import {
  ALL_BIKES_SENTINEL,
  MIN_RIDE_DISTANCE_M,
  MIN_RIDE_MOVING_TIME_S,
  SPEED_BANDS,
} from './ride-analytics.constants';
import { RideRecordDetector } from './ride-record-detector.service';

interface RideCompletedEvent {
  rideId: string;
  userId: string;
  locale: string;
}

interface RideDeletedEvent {
  rideId: string;
  userId: string;
  motorcycleId: string | null;
  startedAt: string;
  distanceM: number;
}

@Injectable()
export class RideRollupAggregator {
  private readonly logger = new Logger(RideRollupAggregator.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly recordDetector: RideRecordDetector,
  ) {}

  @OnEvent('ride.completed', { async: false })
  async onRideCompleted(payload: RideCompletedEvent): Promise<void> {
    this.logger.log(`ride.completed event received for ride ${payload.rideId}`);

    try {
      await this.aggregate(payload.rideId, payload.userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Analytics aggregation failed for ride ${payload.rideId}: ${msg}`);
    }
  }

  @OnEvent('ride.deleted', { async: true })
  async onRideDeleted(payload: RideDeletedEvent): Promise<void> {
    this.logger.log(`ride.deleted event received for ride ${payload.rideId}`);

    try {
      await this.reverseRollups(payload);
      await this.recordDetector.reelectRecords(payload.userId, payload.motorcycleId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to reverse analytics for deleted ride ${payload.rideId}: ${msg}`);
    }
  }

  private async aggregate(rideId: string, userId: string): Promise<void> {
    // 1) Fetch the ride
    const { data: ride, error } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, distance_m, max_speed_mps, avg_speed_mps, max_lean_angle, elevation_gain, elevation_loss, started_at, ended_at, paused_duration_s, auto_paused_duration_s, metadata',
      )
      .eq('id', rideId)
      .eq('user_id', userId)
      .single();

    if (error || !ride) {
      this.logger.warn(`Ride ${rideId} not found for analytics: ${error?.message}`);
      return;
    }

    // 2) Real-ride filter
    const movingTimeS = Math.max(
      0,
      Math.floor(
        (new Date(ride.ended_at).getTime() - new Date(ride.started_at).getTime()) / 1000,
      ) -
        (ride.paused_duration_s ?? 0) -
        (ride.auto_paused_duration_s ?? 0),
    );

    if ((ride.distance_m ?? 0) < MIN_RIDE_DISTANCE_M || movingTimeS < MIN_RIDE_MOVING_TIME_S) {
      this.logger.log(`Ride ${rideId} below real-ride threshold — skipping analytics`);
      return;
    }

    // 3) Idempotency check
    const metadata = (ride.metadata as Record<string, unknown>) ?? {};
    if (metadata.analytics_processed_at) {
      this.logger.log(`Ride ${rideId} already processed — skipping`);
      return;
    }

    // 4) Derive max_lean_angle from waypoints if not set
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

    // 5) Compute speed bands from waypoints
    const bands = await this.computeSpeedBands(rideId);

    // 6) Call the single-transaction RPC
    const rideMetrics = {
      distance_m: ride.distance_m ?? 0,
      moving_time_s: movingTimeS,
      paused_time_s: (ride.paused_duration_s ?? 0) + (ride.auto_paused_duration_s ?? 0),
      elevation_gain_m: ride.elevation_gain ?? 0,
      elevation_loss_m: ride.elevation_loss ?? 0,
      max_speed_mps: ride.max_speed_mps ?? null,
      max_lean_angle: ride.max_lean_angle ?? null,
      band_urban_s: bands.urban,
      band_cruise_s: bands.cruise,
      band_spirited_s: bands.spirited,
      band_silly_s: bands.silly,
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

    // 7) Detect records (after the transaction commits, idempotent via unique constraint)
    await this.recordDetector.detect(userId, ride as any);
  }

  private async computeSpeedBands(
    rideId: string,
  ): Promise<{ urban: number; cruise: number; spirited: number; silly: number }> {
    const { data: waypoints } = await this.supabaseAdmin
      .from('ride_waypoints')
      .select('speed_mps, recorded_at')
      .eq('ride_id', rideId)
      .not('speed_mps', 'is', null)
      .order('recorded_at', { ascending: true });

    const bands = { urban: 0, cruise: 0, spirited: 0, silly: 0 };
    if (!waypoints?.length) return bands;

    for (let i = 0; i < waypoints.length; i++) {
      const speed = waypoints[i].speed_mps ?? 0;
      // Each waypoint represents ~1 second of recording
      const dt =
        i > 0
          ? Math.min(
              5,
              (new Date(waypoints[i].recorded_at).getTime() -
                new Date(waypoints[i - 1].recorded_at).getTime()) /
                1000,
            )
          : 1;

      if (speed < SPEED_BANDS.URBAN_MAX_MPS) {
        bands.urban += dt;
      } else if (speed < SPEED_BANDS.CRUISE_MAX_MPS) {
        bands.cruise += dt;
      } else if (speed < SPEED_BANDS.SPIRITED_MAX_MPS) {
        bands.spirited += dt;
      } else {
        bands.silly += dt;
      }
    }

    return {
      urban: Math.round(bands.urban),
      cruise: Math.round(bands.cruise),
      spirited: Math.round(bands.spirited),
      silly: Math.round(bands.silly),
    };
  }

  private async reverseRollups(payload: RideDeletedEvent): Promise<void> {
    // For Phase 0.5: accept eventual consistency on deletion.
    // Decrement ride_count where possible. Max fields remain stale until next ride.
    const bikeId = payload.motorcycleId ?? ALL_BIKES_SENTINEL;
    const startedAt = new Date(payload.startedAt);
    const day = startedAt.toISOString().split('T')[0];

    // Helper to get ISO week Monday
    const weekDate = new Date(startedAt);
    weekDate.setUTCDate(weekDate.getUTCDate() - ((weekDate.getUTCDay() + 6) % 7));
    const week = weekDate.toISOString().split('T')[0];

    const monthDate = new Date(
      Date.UTC(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), 1),
    );
    const month = monthDate.toISOString().split('T')[0];

    const periods = [
      { kind: 'day', start: day },
      { kind: 'week', start: week },
      { kind: 'month', start: month },
    ];

    for (const period of periods) {
      for (const motoId of [bikeId, ALL_BIKES_SENTINEL]) {
        // Decrement ride_count; if it hits 0, delete the row
        const { data: row } = await this.supabaseAdmin
          .from('ride_rollups')
          .select('ride_count')
          .eq('user_id', payload.userId)
          .eq('motorcycle_id', motoId)
          .eq('period_kind', period.kind)
          .eq('period_start', period.start)
          .maybeSingle();

        if (!row) continue;

        if (row.ride_count <= 1) {
          await this.supabaseAdmin
            .from('ride_rollups')
            .delete()
            .eq('user_id', payload.userId)
            .eq('motorcycle_id', motoId)
            .eq('period_kind', period.kind)
            .eq('period_start', period.start);
        } else {
          // Decrement. Max fields remain stale — acceptable for Phase 0.5.
          await this.supabaseAdmin.rpc('decrement_ride_rollup' as any, {
            p_user_id: payload.userId,
            p_motorcycle_id: motoId,
            p_period_kind: period.kind,
            p_period_start: period.start,
            p_distance_m: payload.distanceM,
          });
        }
      }
    }

    this.logger.log(`Reversed rollups for deleted ride ${payload.rideId}`);
  }
}
