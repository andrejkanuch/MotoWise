import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import type { TripWaypoint } from '../models/trip.model';
import { type WaypointRow, mapRowToWaypoint, verifyOrganiser } from './trip-lifecycle.service';

@Injectable()
export class TripWaypointsService {
  private readonly logger = new Logger(TripWaypointsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async addWaypoint(
    userId: string,
    input: {
      tripId: string;
      type: string;
      name: string;
      lat: number;
      lng: number;
      notes?: string;
      sortOrder: number;
      dayIndex?: number;
      periodOfDay?: string;
    },
  ): Promise<TripWaypoint> {
    await verifyOrganiser(this.supabase, this.logger, userId, input.tripId);

    const { data, error } = await this.supabase
      .from('trip_waypoints')
      .insert({
        trip_id: input.tripId,
        type: input.type,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        notes: input.notes ?? null,
        sort_order: input.sortOrder,
        day_index: input.dayIndex ?? 0,
        period_of_day: input.periodOfDay ?? null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`addWaypoint failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to add waypoint');
    }

    return mapRowToWaypoint(data as unknown as WaypointRow);
  }

  async updateWaypoint(
    userId: string,
    waypointId: string,
    input: {
      type?: string;
      name?: string;
      lat?: number;
      lng?: number;
      notes?: string;
      sortOrder?: number;
      dayIndex?: number;
      periodOfDay?: string | null;
    },
  ): Promise<TripWaypoint> {
    // Get waypoint to find trip_id
    const { data: wp, error: wpError } = await this.supabase
      .from('trip_waypoints')
      .select('trip_id')
      .eq('id', waypointId)
      .single();

    if (wpError || !wp) {
      throw new NotFoundException('Waypoint not found');
    }

    await verifyOrganiser(this.supabase, this.logger, userId, wp.trip_id);

    const update: Record<string, unknown> = {};
    if (input.type !== undefined) update.type = input.type;
    if (input.name !== undefined) update.name = input.name;
    if (input.lat !== undefined) update.lat = input.lat;
    if (input.lng !== undefined) update.lng = input.lng;
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
    if (input.dayIndex !== undefined) update.day_index = input.dayIndex;
    if (input.periodOfDay !== undefined) update.period_of_day = input.periodOfDay;

    const { data, error } = await this.supabase
      .from('trip_waypoints')
      .update(update)
      .eq('id', waypointId)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`updateWaypoint failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to update waypoint');
    }

    return mapRowToWaypoint(data as unknown as WaypointRow);
  }

  async removeWaypoint(userId: string, waypointId: string): Promise<boolean> {
    // Get waypoint to find trip_id
    const { data: wp, error: wpError } = await this.supabase
      .from('trip_waypoints')
      .select('trip_id')
      .eq('id', waypointId)
      .single();

    if (wpError || !wp) {
      throw new NotFoundException('Waypoint not found');
    }

    await verifyOrganiser(this.supabase, this.logger, userId, wp.trip_id);

    const { error } = await this.supabase.from('trip_waypoints').delete().eq('id', waypointId);

    if (error) {
      this.logger.error(`removeWaypoint failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to remove waypoint');
    }

    return true;
  }

  async reorderWaypoints(userId: string, tripId: string, waypointIds: string[]): Promise<boolean> {
    await verifyOrganiser(this.supabase, this.logger, userId, tripId);

    // Atomic reorder via RPC — single transaction
    const { error } = await this.supabaseAdmin.rpc('reorder_trip_waypoints', {
      p_trip_id: tripId,
      p_waypoint_ids: waypointIds,
    });

    if (error) {
      this.logger.error(`reorderWaypoints failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to reorder waypoints');
    }

    return true;
  }
}
