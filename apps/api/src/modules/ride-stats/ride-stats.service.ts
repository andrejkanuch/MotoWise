import { RIDE_STATUS } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RIDE_TRACK_POINTS_RPC, type TrackPointsRow } from '../../common/track-points';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { computeRideStats, RIDE_STATS_VERSION } from './compute/compute-ride-stats';
import { createPlacesLookup, REFERENCE_MISSING } from './compute/places';
import { isValidIanaZone } from './compute/time-zone';
import { yieldToEventLoop } from './compute/track';
import { fetchRideWeather, isWeatherEnabled, WEATHER_API_KEY_ENV } from './compute/weather';
import {
  RIDE_PRIVATE_DETAILS_TABLE,
  RIDE_STATS_TABLE,
  RIDE_TRACKS_TABLE,
  type RideForStats,
  type RideStatsWeatherWrite,
} from './ride-stats.types';

/**
 * SQL helpers the sweep needs (service role only):
 *
 *   ride_stats_stale_rides(p_stats_version smallint, p_limit int, p_exclude uuid[])
 *     RETURNS TABLE (ride_id uuid, user_id uuid, is_synthetic boolean, stale_since timestamptz)
 *   Completed, not soft-deleted rides not in p_exclude that have no ride_stats
 *   row, a row below p_stats_version, or rides.track_updated_at after
 *   computed_at. Real riders first (users.is_synthetic last), then oldest first.
 *
 *   ride_stats_stale_count(p_stats_version smallint, p_older_than timestamptz) RETURNS integer
 *   The same staleness, counting rides whose COALESCE(track_updated_at, ended_at)
 *   is before p_older_than.
 */
export const STALE_RIDES_RPC = 'ride_stats_stale_rides';
export const STALE_COUNT_RPC = 'ride_stats_stale_count';

/** Rides one sweep run computes, one after another. */
export const RIDE_STATS_SWEEP_BATCH_SIZE = 10;
/** A ride still stale this long after it changed is reported. */
const STALE_ALERT_AFTER_MS = 60 * 60 * 1000;
/** Recent ride_private_details rows read to find a rider's latest valid zone. */
const RIDER_ZONE_LOOKBACK = 5;

const RIDE_COLUMNS =
  'id, user_id, motorcycle_id, status, deleted_at, started_at, ended_at, distance_m, route_polyline';

type RideRow = Omit<RideForStats, 'time_zone'>;

export const COMPUTE_RIDE_RESULT = {
  WRITTEN: 'written',
  REFERENCE_MISSING,
  NOT_ELIGIBLE: 'not_eligible',
} as const;
export type ComputeRideResult = (typeof COMPUTE_RIDE_RESULT)[keyof typeof COMPUTE_RIDE_RESULT];

export interface RideStatsSweepSummary {
  examined: number;
  written: number;
  /** Rides that threw this run; they join the skip list. */
  skipped: string[];
  /** Rides left stale because the reference geodata is not loaded. */
  referenceMissing: number;
  /** Rides still stale more than an hour after they changed, counted after the run. */
  staleOverOneHour: number;
}

interface StaleRide {
  ride_id: string;
  user_id: string;
  is_synthetic: boolean;
  stale_since: string;
}

@Injectable()
export class RideStatsService {
  private readonly logger = new Logger(RideStatsService.name);
  /**
   * Rides whose compute threw. Excluded from later runs in this process so a
   * ride that always fails cannot hold a batch slot forever; they still show in
   * the stale-over-an-hour count, which is reported every run.
   */
  private readonly skipList = new Set<string>();

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  async computeRide(rideId: string): Promise<ComputeRideResult> {
    // Stamped before anything is read: a track_updated_at bump that lands while
    // this compute runs is then later than computed_at, so the sweep's
    // `track_updated_at > computed_at` rule picks the ride up again.
    const computedAt = new Date().toISOString();
    const { data: row, error } = await this.supabaseAdmin
      .from('rides')
      .select(RIDE_COLUMNS)
      .eq('id', rideId)
      .maybeSingle<RideRow>();
    if (error) throw new Error(`ride ${rideId} read failed: ${error.message}`);
    if (!row || row.status !== RIDE_STATUS.COMPLETED || row.deleted_at !== null) {
      return COMPUTE_RIDE_RESULT.NOT_ELIGIBLE;
    }

    const [deviceZone, trackPoints, bikeType] = await Promise.all([
      this.loadDeviceZone(rideId),
      this.loadTrackPoints(rideId),
      this.loadBikeType(row.motorcycle_id),
    ]);
    const ride: RideForStats = { ...row, time_zone: deviceZone };

    const outcome = await computeRideStats(
      { ride, trackPoints, bikeType },
      {
        lookupPlaces: createPlacesLookup(this.supabaseAdmin),
        riderZone: () => this.loadRiderZone(ride.user_id),
        yieldFn: yieldToEventLoop,
      },
    );
    if (outcome.kind === REFERENCE_MISSING) return COMPUTE_RIDE_RESULT.REFERENCE_MISSING;

    if (outcome.track) {
      const { error: trackError } = await this.supabaseAdmin
        .from(RIDE_TRACKS_TABLE)
        .upsert({ ...outcome.track, built_at: computedAt }, { onConflict: 'ride_id' });
      if (trackError) throw new Error(`ride_tracks upsert failed: ${trackError.message}`);
    }
    const { error: statsError } = await this.supabaseAdmin
      .from(RIDE_STATS_TABLE)
      .upsert({ ...outcome.stats, computed_at: computedAt }, { onConflict: 'ride_id' });
    if (statsError) throw new Error(`ride_stats upsert failed: ${statsError.message}`);

    if (outcome.start && ride.ended_at && isWeatherEnabled(this.config)) {
      await this.runWeatherStep(rideId, outcome.start, ride.started_at, ride.ended_at);
    }
    return COMPUTE_RIDE_RESULT.WRITTEN;
  }

  async sweepStale(): Promise<RideStatsSweepSummary> {
    const { data, error } = await this.supabaseAdmin.rpc(STALE_RIDES_RPC, {
      p_stats_version: RIDE_STATS_VERSION,
      p_limit: RIDE_STATS_SWEEP_BATCH_SIZE,
      p_exclude: [...this.skipList],
    });
    if (error) throw new Error(`${STALE_RIDES_RPC} failed: ${error.message}`);
    const stale = (data as StaleRide[] | null) ?? [];

    const summary: RideStatsSweepSummary = {
      examined: stale.length,
      written: 0,
      skipped: [],
      referenceMissing: 0,
      staleOverOneHour: 0,
    };

    for (const { ride_id: rideId } of stale) {
      await yieldToEventLoop();
      try {
        const result = await this.computeRide(rideId);
        if (result === COMPUTE_RIDE_RESULT.WRITTEN) summary.written++;
        if (result === COMPUTE_RIDE_RESULT.REFERENCE_MISSING) summary.referenceMissing++;
      } catch (err) {
        this.skipList.add(rideId);
        summary.skipped.push(rideId);
        this.logger.error(
          `ride stats compute failed for ride ${rideId}: ${err instanceof Error ? err.message : String(err)}`,
        );
        Sentry.captureException(err, {
          tags: { area: 'ride-stats', op: 'sweep' },
          extra: { rideId },
        });
      }
    }

    if (summary.referenceMissing > 0) {
      const message = `ride stats: reference geodata (ref_country_parts) is empty; ${summary.referenceMissing} rides left stale this run`;
      this.logger.warn(message);
      Sentry.captureMessage(message, { level: 'warning', tags: { area: 'ride-stats' } });
    }

    summary.staleOverOneHour = await this.countStaleOverOneHour();
    if (summary.staleOverOneHour > 0) {
      const message = `ride stats: ${summary.staleOverOneHour} rides stale for over an hour`;
      this.logger.warn(message);
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: { area: 'ride-stats' },
        extra: { skipList: [...this.skipList] },
      });
    }
    return summary;
  }

  private async countStaleOverOneHour(): Promise<number> {
    const { data, error } = await this.supabaseAdmin.rpc(STALE_COUNT_RPC, {
      p_stats_version: RIDE_STATS_VERSION,
      p_older_than: new Date(Date.now() - STALE_ALERT_AFTER_MS).toISOString(),
    });
    if (error) throw new Error(`${STALE_COUNT_RPC} failed: ${error.message}`);
    return Number(data ?? 0);
  }

  /** Every fix of the ride in one row (no downsampling). Null when it has none. */
  private async loadTrackPoints(rideId: string): Promise<TrackPointsRow | null> {
    const { data, error } = await this.supabaseAdmin.rpc(RIDE_TRACK_POINTS_RPC, {
      p_ride_id: rideId,
      p_max_points: null,
    });
    if (error) throw new Error(`${RIDE_TRACK_POINTS_RPC} failed: ${error.message}`);
    return ((data as TrackPointsRow[] | null) ?? [])[0] ?? null;
  }

  private async loadBikeType(motorcycleId: string | null): Promise<string | null> {
    if (!motorcycleId) return null;
    const { data, error } = await this.supabaseAdmin
      .from('motorcycles')
      .select('type')
      .eq('id', motorcycleId)
      .maybeSingle<{ type: string | null }>();
    if (error) throw new Error(`motorcycle ${motorcycleId} read failed: ${error.message}`);
    return data?.type ?? null;
  }

  /** The device zone the client sent for the ride; null when it has no ride_private_details row. */
  private async loadDeviceZone(rideId: string): Promise<string | null> {
    const { data, error } = await this.supabaseAdmin
      .from(RIDE_PRIVATE_DETAILS_TABLE)
      .select('time_zone')
      .eq('ride_id', rideId)
      .maybeSingle<{ time_zone: string | null }>();
    if (error) throw new Error(`ride ${rideId} private details read failed: ${error.message}`);
    return data?.time_zone ?? null;
  }

  /** The rider's latest valid device zone, newest ride_private_details row first. */
  private async loadRiderZone(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseAdmin
      .from(RIDE_PRIVATE_DETAILS_TABLE)
      .select('time_zone')
      .eq('user_id', userId)
      .not('time_zone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(RIDER_ZONE_LOOKBACK);
    if (error) throw new Error(`rider zone read failed: ${error.message}`);
    const zones = ((data as Array<{ time_zone: string | null }> | null) ?? []).map(
      (r) => r.time_zone,
    );
    return zones.find((z) => isValidIanaZone(z)) ?? null;
  }

  private async runWeatherStep(
    rideId: string,
    start: { lat: number; lng: number },
    startedAt: string,
    endedAt: string,
  ): Promise<void> {
    const { data: existing } = await this.supabaseAdmin
      .from(RIDE_STATS_TABLE)
      .select('weather_fetched_at')
      .eq('ride_id', rideId)
      .maybeSingle<{ weather_fetched_at: string | null }>();
    if (existing?.weather_fetched_at) return;

    const weather = await fetchRideWeather({
      start,
      startedAt,
      endedAt,
      apiKey: this.config.get<string>(WEATHER_API_KEY_ENV) as string,
    });
    if (!weather) return;
    const update: RideStatsWeatherWrite = {
      weather: weather.weather,
      weather_fetched_at: new Date().toISOString(),
      temp_min_c: weather.tempMinC,
      temp_max_c: weather.tempMaxC,
      wet: weather.wet,
    };
    const { error } = await this.supabaseAdmin
      .from(RIDE_STATS_TABLE)
      .update(update)
      .eq('ride_id', rideId);
    if (error) this.logger.warn(`weather write failed for ride ${rideId}: ${error.message}`);
  }
}
