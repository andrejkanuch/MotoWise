import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { QUERY_LIMITS } from '../../config/constants';
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

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async startRide(userId: string, input: StartRideInput): Promise<Ride> {
    this.logger.log(`startRide: userId=${userId}, rideId=${input.rideId}`);

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

  async endRide(userId: string, input: EndRideInput): Promise<Ride> {
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
      })
      .eq('id', input.rideId)
      .eq('user_id', userId)
      .in('status', ['recording', 'paused'])
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`endRide failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to end ride');
    }
    return this.mapRow(data);
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
      .in('status', ['recording', 'paused'])
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
    if (input.isPublic !== undefined) updates.is_public = input.isPublic;

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

    const { data, error } = await this.supabase
      .from('rides')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(`deleteRide failed: ${error?.message} (${error?.code})`);
      throw new NotFoundException('Ride not found');
    }
    return true;
  }

  async myRides(
    userId: string,
    first: number,
    after?: string,
    motorcycleId?: string,
  ): Promise<RideConnection> {
    this.logger.debug(`myRides: userId=${userId}, first=${first}, after=${after}`);

    const limit = Math.min(first, 50);
    let query = this.supabase
      .from('rides')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(limit + 1);

    if (motorcycleId) {
      query = query.eq('motorcycle_id', motorcycleId);
    }

    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf-8');
      const ts = Date.parse(decoded);
      if (Number.isNaN(ts)) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('started_at', decoded);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`myRides failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch rides');
    }

    const rows = data ?? [];
    const hasNextPage = rows.length > limit;
    const sliced = hasNextPage ? rows.slice(0, limit) : rows;

    const edges = sliced.map((row) => {
      const ride = this.mapRow(row);
      return {
        node: ride,
        cursor: Buffer.from(ride.startedAt).toString('base64'),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: count ?? 0,
    };
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
      isPublic: (row.is_public as boolean) ?? false,
      region: (row.region as string) ?? undefined,
      routeThumbnailUri: (row.route_thumbnail_uri as string) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
