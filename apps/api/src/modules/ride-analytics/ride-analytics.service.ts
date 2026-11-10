import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrapServiceRole } from '../../common/supabase/unwrap';
import { resolveRiderTimeZone } from '../../common/time-zone/rider-time-zone';
import { type OverviewRow, RIDER_RIDE_OVERVIEW_RPC } from '../rider-insights/rider-insights.types';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RideOverview } from './models/ride-overview.model';

@Injectable()
export class RideAnalyticsService {
  private readonly logger = new Logger(RideAnalyticsService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient) {}

  /**
   * The ride overview and personal records, computed by `rider_ride_overview`
   * from rides and their stats (every completed, not deleted ride), with day,
   * week and month buckets in `timeZone`. Without one (or with one that is not
   * an IANA zone) the buckets use the rider's latest ride zone, then UTC.
   */
  async getRideOverview(userId: string, timeZone?: string | null): Promise<RideOverview> {
    const zone = await resolveRiderTimeZone(this.supabaseAdmin, userId, timeZone);
    const result = await this.supabaseAdmin.rpc(RIDER_RIDE_OVERVIEW_RPC, {
      p_user_id: userId,
      p_tz: zone,
    });
    const row = unwrapServiceRole<OverviewRow>(result, {
      logger: this.logger,
      op: 'rideOverview',
      message: 'Could not read the ride overview',
    });

    const last = row.lastRide;
    return {
      lastRide: last
        ? {
            id: last.id,
            distanceM: last.distanceM,
            durationS: last.durationS,
            maxSpeedMps: last.maxSpeedMps ?? undefined,
            date: last.date,
            motorcycleName: last.motorcycleName ?? undefined,
            summaryTitle: last.summaryTitle ?? undefined,
          }
        : undefined,
      last7Days: row.last7Days,
      last30Days: row.last30Days,
      thisWeek: row.thisWeek,
      thisMonth: row.thisMonth,
      dailyDistances: row.dailyDistances,
      currentStreak: row.currentStreak,
      personalRecords: row.personalRecords.map((record) => ({
        recordType: record.recordType,
        value: record.value,
        unit: record.unit,
        achievedAt: record.achievedAt,
        previousValue: record.previousValue ?? undefined,
        rideId: record.rideId ?? undefined,
      })),
    };
  }
}
