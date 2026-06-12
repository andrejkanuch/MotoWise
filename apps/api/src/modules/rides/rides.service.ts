import { type MileageUnit, metersToUnit } from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RIDE_EVENTS } from '../../common/constants/events';
import { buildConnection, decodeCursor, encodeCursor } from '../../common/pagination/connection';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { QUERY_LIMITS } from '../../config/constants';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { EndRideInput } from './dto/end-ride.input';
import type { StartRideInput } from './dto/start-ride.input';
import type { UpdateRideInput } from './dto/update-ride.input';
import type { UploadWaypointsInput } from './dto/upload-waypoints.input';
import type { Ride } from './models/ride.model';
import type { RideConnection } from './models/ride-connection.model';
import type { Waypoint } from './models/waypoint.model';

const MAX_WAYPOINTS_PER_RIDE = QUERY_LIMITS.MAX_WAYPOINTS_PER_RIDE;

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startRide(userId: string, input: StartRideInput): Promise<Ride> {
    this.logger.log(`startRide: userId=${userId}, rideId=${input.rideId}`);

    // Auto-end any stale active rides so the unique-index
    // (rides_one_active_per_user) doesn't block the new insert.
    // This handles cases where a previous ride wasn't properly ended
    // (app crash, reinstall, cleared local data).
    await this.supabase
      .from('rides')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('status', ['recording', 'paused'])
      .is('deleted_at', null);

    const { data, error } = await this.supabase
      .from('rides')
      .insert({
        id: input.rideId,
        user_id: userId,
        motorcycle_id: input.motorcycleId ?? null,
        status: 'recording',
        started_at: input.startedAt,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`startRide failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to start ride');
    }
    return this.mapRow(data);
  }

  async endRide(
    userId: string,
    input: EndRideInput,
  ): Promise<{
    ride: Ride;
    triggeredMaintenanceTasks: { id: string; title: string; priority: string }[];
  }> {
    this.logger.log(`endRide: userId=${userId}, rideId=${input.rideId}`);

    const { data, error } = await this.supabase
      .from('rides')
      .update({
        status: 'completed',
        ended_at: input.endedAt,
        distance_m: input.distanceM,
        max_speed_mps: input.maxSpeedMps ?? null,
        avg_speed_mps: input.avgSpeedMps ?? null,
        elevation_gain: input.elevationGain ?? null,
        elevation_loss: input.elevationLoss ?? null,
        route_polyline: input.routePolyline ?? null,
        gps_quality: input.gpsQuality ?? null,
        paused_duration_s: input.pausedDurationS,
        auto_paused_duration_s: input.autoPausedDurationS,
        ...(input.maxLeanAngle != null && { max_lean_angle: input.maxLeanAngle }),
      })
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .in('status', ['recording', 'paused'])
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      // Idempotent retry (MOT-140): a sync-queue retry or duplicate tap arrives
      // after the ride is already completed; the status filter above matched 0
      // rows. Return the completed ride as success — do NOT re-emit ride.completed
      // or re-apply mileage.
      if (error?.code === PG_ERROR.NOT_FOUND) {
        const { data: existing } = await this.supabase
          .from('rides')
          .select('*')
          .eq('id', input.rideId)
          .eq('user_id', userId)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .single();
        if (existing) {
          this.logger.log(`endRide: ride ${input.rideId} already completed — idempotent success`);
          return { ride: this.mapRow(existing), triggeredMaintenanceTasks: [] };
        }
      }
      this.logger.error(`endRide failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to end ride');
    }

    const ride = this.mapRow(data);
    let triggeredMaintenanceTasks: { id: string; title: string; priority: string }[] = [];

    // MOT-140: claim-first odometer sync. A single conditional UPDATE flips
    // mileage_applied false→true and returns the row to exactly ONE caller;
    // concurrent endRides (two devices) and retries match 0 rows and skip the
    // odometer, so mileage is applied exactly once with no read-modify-write race.
    const { data: claimed } = await this.supabase
      .from('rides')
      .update({ mileage_applied: true })
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .eq('mileage_applied', false)
      .select('distance_m, motorcycle_id')
      .single();

    const motorcycleId = claimed?.motorcycle_id;
    const distanceM = claimed?.distance_m ?? 0;

    if (claimed && motorcycleId && distanceM > 0) {
      try {
        // Defense-in-depth: filter by user_id alongside RLS
        const { data: bike } = await this.supabase
          .from('motorcycles')
          .select('current_mileage, mileage_unit')
          .eq('id', motorcycleId)
          .eq('user_id', userId)
          .single();

        // MOT-140 bug fix: current_mileage is stored in the user's preferred
        // unit (km or mi). Previously distanceM (meters) was added directly,
        // producing wildly inflated odometer readings on every ride.
        // P2-109: Uses metersToUnit from @motovault/types so this conversion
        // lives in exactly one place across the whole codebase.
        const unit: MileageUnit = (bike?.mileage_unit as MileageUnit | null) ?? 'mi';
        const roundedDelta = Math.round(metersToUnit(distanceM, unit));
        const newMileage = (bike?.current_mileage ?? 0) + roundedDelta;

        const nowIso = new Date().toISOString();

        await this.supabase
          .from('motorcycles')
          .update({
            current_mileage: newMileage,
            mileage_updated_at: nowIso,
            odometer_sync_source: 'gps_ride',
            odometer_last_ride_id: input.rideId,
          })
          .eq('id', motorcycleId)
          .eq('user_id', userId);

        // NOTE: mileage_applied was already claimed above, so a failure in this
        // block leaves it true — the ride won't re-sync on retry. A missed
        // odometer update is rare and user-correctable via manual edit; this is
        // the deliberate trade for race-free exactly-once application.
        this.logger.log(
          `Odometer sync: +${roundedDelta}${unit} to motorcycle ${motorcycleId} (total: ${newMileage}${unit}, ride=${input.rideId})`,
        );

        // Check for maintenance tasks that are now due (target_mileage is in
        // the same user-unit as current_mileage, so the new total is valid here)
        const { data: dueTasks } = await this.supabase
          .from('maintenance_tasks')
          .select('id, title, priority')
          .eq('motorcycle_id', motorcycleId)
          .eq('status', 'pending')
          .not('target_mileage', 'is', null)
          .lte('target_mileage', newMileage);

        if (dueTasks && dueTasks.length > 0) {
          triggeredMaintenanceTasks = dueTasks;
          this.logger.log(
            `${dueTasks.length} maintenance task(s) triggered for motorcycle ${motorcycleId}`,
          );
        }
      } catch (mileageError) {
        const msg = mileageError instanceof Error ? mileageError.message : String(mileageError);
        this.logger.warn(`Failed to apply mileage: ${msg}`);
        // Non-fatal — ride is already saved
      }
    }

    // Emit event for async AI ride summary generation
    this.eventEmitter.emit(RIDE_EVENTS.COMPLETED, {
      rideId: ride.id,
      userId,
      locale: 'en', // TODO: pass user's preferred locale
    });

    return { ride, triggeredMaintenanceTasks };
  }

  async uploadWaypoints(userId: string, input: UploadWaypointsInput): Promise<number> {
    this.logger.log(
      `uploadWaypoints: userId=${userId}, rideId=${input.rideId}, count=${input.waypoints.length}`,
    );

    // Verify ride ownership
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id')
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .in('status', ['recording', 'paused', 'completed'])
      .is('deleted_at', null)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found or not active');
    }

    // Check waypoint quota
    const { count, error: countError } = await this.supabase
      .from('ride_waypoints')
      .select('ride_id', { count: 'exact', head: true })
      .eq('ride_id', input.rideId);

    if (countError) {
      throw new InternalServerErrorException('Failed to check waypoint count');
    }

    if ((count ?? 0) + input.waypoints.length > MAX_WAYPOINTS_PER_RIDE) {
      throw new BadRequestException(
        `Waypoint limit exceeded. Maximum ${MAX_WAYPOINTS_PER_RIDE} per ride.`,
      );
    }

    // INSERT...ON CONFLICT DO NOTHING for idempotency
    const rows = input.waypoints.map((wp) => ({
      ride_id: input.rideId,
      recorded_at: wp.recordedAt,
      latitude: wp.latitude,
      longitude: wp.longitude,
      altitude: wp.altitude ?? null,
      speed_mps: wp.speedMps ?? null,
      heading: wp.heading ?? null,
      accuracy: wp.accuracy ?? null,
    }));

    const { error } = await this.supabase.from('ride_waypoints').upsert(rows, {
      onConflict: 'ride_id,recorded_at',
      ignoreDuplicates: true,
    });

    if (error) {
      this.logger.error(`uploadWaypoints failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to upload waypoints');
    }

    return input.waypoints.length;
  }

  async updateRide(userId: string, input: UpdateRideInput): Promise<Ride> {
    this.logger.log(`updateRide: userId=${userId}, rideId=${input.rideId}`);

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.mileageApplied !== undefined) updates.mileage_applied = input.mileageApplied;
    if (input.isPublic !== undefined) {
      // Dual-write: `visibility` is canonical (RLS gates on it); `is_public` stays in
      // sync until every SQL consumer is migrated and the column is dropped (00143).
      updates.is_public = input.isPublic;
      updates.visibility = input.isPublic ? 'public' : 'private';
    }

    const { data, error } = await this.supabase
      .from('rides')
      .update(updates)
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`updateRide failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to update ride');
    }
    return this.mapRow(data);
  }

  async deleteRide(userId: string, id: string): Promise<boolean> {
    this.logger.log(`deleteRide: userId=${userId}, rideId=${id}`);

    // Uses supabaseAdmin because the soft-delete UPDATE sets deleted_at,
    // which makes the new row invisible to SELECT RLS policies
    // (they require deleted_at IS NULL). PostgreSQL rejects the UPDATE
    // when the new row fails SELECT visibility — even though the UPDATE
    // WITH CHECK passes. Ownership is enforced via .eq('user_id', userId)
    // where userId comes from the authenticated JWT.
    const { data, error } = await this.supabaseAdmin
      .from('rides')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (data) return true;

    // Idempotent: if the ride is already soft-deleted, treat as success
    // (sync queue retries, duplicate taps, etc.)
    if (error?.code === PG_ERROR.NOT_FOUND) {
      const { count } = await this.supabaseAdmin
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('id', id)
        .eq('user_id', userId)
        .not('deleted_at', 'is', null);

      if (count && count > 0) {
        this.logger.log(`deleteRide: ride ${id} already deleted — idempotent success`);
        return true;
      }
    }

    this.logger.error(`deleteRide failed: ${error?.message} (${error?.code})`);
    throw new NotFoundException('Ride not found');
  }

  // ==========================================
  // Ride visibility + sharing (privacy feature)
  // ==========================================

  /** Update a ride's visibility setting. Owner-only via RLS. */
  async updateRideVisibility(
    userId: string,
    rideId: string,
    visibility: 'private' | 'unlisted' | 'public',
  ): Promise<Ride> {
    // Dual-write is_public until every SQL consumer is migrated off it (00143)
    const { data, error } = await this.supabase
      .from('rides')
      .update({ visibility, is_public: visibility === 'public' })
      .eq('id', rideId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Ride not found');
    }
    return this.mapRow(data);
  }

  /** Grant a specific user read access to a private ride. */
  async shareRide(userId: string, rideId: string, sharedWithUserId: string): Promise<boolean> {
    const { error } = await this.supabase.from('ride_shares').insert({
      ride_id: rideId,
      shared_with_user_id: sharedWithUserId,
      shared_by_user_id: userId,
    });

    if (error) {
      // Idempotent on duplicate — already shared
      if (error.code === PG_ERROR.UNIQUE_VIOLATION) return true;
      this.logger.error(`shareRide failed: ${error.message}`);
      throw new BadRequestException('Failed to share ride');
    }
    return true;
  }

  /** Revoke a user's access to a previously shared private ride. */
  async unshareRide(userId: string, rideId: string, sharedWithUserId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('ride_shares')
      .delete()
      .eq('ride_id', rideId)
      .eq('shared_with_user_id', sharedWithUserId)
      .eq('shared_by_user_id', userId);

    if (error) {
      this.logger.error(`unshareRide failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to unshare ride');
    }
    return true;
  }

  /** List users the ride has been shared with. Owner-only (or admin via RLS). */
  async listRideShares(
    userId: string,
    rideId: string,
  ): Promise<Array<{ sharedWithUserId: string; sharedAt: string }>> {
    const { data, error } = await this.supabase
      .from('ride_shares')
      .select('shared_with_user_id, created_at')
      .eq('ride_id', rideId)
      .eq('shared_by_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`listRideShares failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to list ride shares');
    }

    return (data ?? []).map((row) => ({
      sharedWithUserId: row.shared_with_user_id as string,
      sharedAt: row.created_at as string,
    }));
  }

  async myRides(
    userId: string,
    first: number,
    after?: string,
    motorcycleId?: string,
  ): Promise<RideConnection> {
    this.logger.debug(`myRides: userId=${userId}, first=${first}, after=${after}`);

    const limit = Math.min(first, 50);
    // Explicit column list matches Ride model fields (see rides/models/ride.model.ts
    // + mapRow below). Avoids shipping heavy `metadata` / `weather_snapshot` / `ai_summary`
    // blobs that the GraphQL surface doesn't expose. `count: 'estimated'` keeps totalCount
    // cheap for large histories — we don't need exact row count for pagination.
    let query = this.supabase
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, status, name, started_at, ended_at, distance_m, max_speed_mps, avg_speed_mps, max_lean_angle, elevation_gain, elevation_loss, route_polyline, route_thumbnail_uri, gps_quality, paused_duration_s, auto_paused_duration_s, mileage_applied, is_public, visibility, region, created_at, updated_at',
        { count: 'estimated' },
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(limit + 1);

    if (motorcycleId) {
      query = query.eq('motorcycle_id', motorcycleId);
    }

    if (after) {
      const decoded = decodeCursor(after);
      if (!decoded) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('started_at', decoded[0]);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`myRides failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch rides');
    }

    return buildConnection({
      rows: data ?? [],
      limit,
      mapNode: (row) => this.mapRow(row),
      cursorOf: (row) => encodeCursor(row.started_at),
      totalCount: count ?? 0,
      hasPreviousPage: !!after,
    });
  }

  async getPublicRide(id: string): Promise<Ride> {
    this.logger.debug(`getPublicRide: rideId=${id}`);

    // `visibility` is the canonical access column (RLS gates on it); the previous
    // is_public gate disagreed with RLS whenever the two columns drifted (audit C6).
    const { data, error } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, status, name, started_at, ended_at, distance_m, max_speed_mps, avg_speed_mps, max_lean_angle, elevation_gain, elevation_loss, gps_quality, paused_duration_s, auto_paused_duration_s, mileage_applied, visibility, region, route_polyline, route_thumbnail_uri, created_at, updated_at',
      )
      .eq('id', id)
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Ride not found');
    }
    return this.mapRow(data);
  }

  async findById(userId: string, id: string): Promise<Ride> {
    this.logger.debug(`findById: userId=${userId}, rideId=${id}`);

    const { data, error } = await this.supabase
      .from('rides')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Ride not found');
    }
    return this.mapRow(data);
  }

  async findWaypoints(userId: string, rideId: string, maxPoints?: number): Promise<Waypoint[]> {
    this.logger.debug(`findWaypoints: userId=${userId}, rideId=${rideId}, maxPoints=${maxPoints}`);

    // Verify ride ownership (RLS handles this, but explicit check for clear errors)
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('id')
      .eq('id', rideId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found');
    }

    // Fetch waypoints ordered by time, filter poor accuracy
    const { data, error } = await this.supabase
      .from('ride_waypoints')
      .select('recorded_at, latitude, longitude, altitude, speed_mps, accuracy')
      .eq('ride_id', rideId)
      .or(`accuracy.is.null,accuracy.lte.${QUERY_LIMITS.WAYPOINT_ACCURACY_THRESHOLD}`)
      .order('recorded_at', { ascending: true })
      .limit(QUERY_LIMITS.MAX_WAYPOINTS_PER_RIDE);

    if (error) {
      this.logger.error(`findWaypoints failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch waypoints');
    }

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // Server-side downsampling
    const limit = Math.min(
      Math.max(maxPoints ?? QUERY_LIMITS.WAYPOINT_QUERY_DEFAULT, 2),
      QUERY_LIMITS.WAYPOINT_QUERY_MAX,
    );
    const sampled = rows.length <= limit ? rows : this.downsample(rows, limit);

    return sampled.map((row) => ({
      recordedAt: row.recorded_at as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      altitude: (row.altitude as number) ?? undefined,
      speedMps: (row.speed_mps as number) ?? undefined,
      accuracy: (row.accuracy as number) ?? undefined,
    }));
  }

  private downsample<T>(rows: T[], maxPoints: number): T[] {
    if (rows.length <= maxPoints) return rows;
    const result: T[] = [rows[0]];
    const step = (rows.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      result.push(rows[Math.round(i * step)]);
    }
    result.push(rows[rows.length - 1]);
    return result;
  }

  private mapRow(row: Record<string, unknown>): Ride {
    // `isPublic` is DERIVED from canonical `visibility` so old OTA bundles reading
    // either field always see consistent values (audit C6). The is_public fallback
    // covers selects that predate the visibility column in their column list.
    const visibility =
      (row.visibility as string) ?? ((row.is_public as boolean) ? 'public' : 'private');
    return {
      id: row.id as string,
      userId: row.user_id as string,
      motorcycleId: (row.motorcycle_id as string) ?? undefined,
      status: row.status as string,
      name: (row.name as string) ?? undefined,
      startedAt: row.started_at as string,
      endedAt: (row.ended_at as string) ?? undefined,
      durationS: row.ended_at
        ? Math.round(
            (new Date(row.ended_at as string).getTime() -
              new Date(row.started_at as string).getTime()) /
              1000,
          )
        : undefined,
      pausedDurationS: (row.paused_duration_s as number) ?? 0,
      autoPausedDurationS: (row.auto_paused_duration_s as number) ?? 0,
      distanceM: (row.distance_m as number) ?? undefined,
      maxSpeedMps: (row.max_speed_mps as number) ?? undefined,
      avgSpeedMps: (row.avg_speed_mps as number) ?? undefined,
      maxLeanAngle: (row.max_lean_angle as number) ?? undefined,
      elevationGain: (row.elevation_gain as number) ?? undefined,
      elevationLoss: (row.elevation_loss as number) ?? undefined,
      routePolyline: (row.route_polyline as string) ?? undefined,
      gpsQuality: (row.gps_quality as number) ?? undefined,
      mileageApplied: (row.mileage_applied as boolean) ?? false,
      isPublic: visibility === 'public',
      visibility,
      region: (row.region as string) ?? undefined,
      routeThumbnailUri: (row.route_thumbnail_uri as string) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
