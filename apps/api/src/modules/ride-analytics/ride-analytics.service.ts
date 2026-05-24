import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { Last7DaysSummary, LastRideSummary, RideOverview } from './models/ride-overview.model';
import type { RideRecord } from './models/ride-record.model';
import { ALL_BIKES_SENTINEL } from './ride-analytics.constants';
import { computeMovingTimeS } from './ride-analytics.utils';

@Injectable()
export class RideAnalyticsService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient) {}

  async getRideOverview(userId: string): Promise<RideOverview> {
    const [lastRide, last7Days, currentStreak, personalRecords] = await Promise.all([
      this.getLastRide(userId),
      this.getLast7Days(userId),
      this.getCurrentStreak(userId),
      this.getPersonalRecords(userId),
    ]);

    return { lastRide, last7Days, currentStreak, personalRecords };
  }

  private async getLastRide(userId: string): Promise<LastRideSummary | undefined> {
    const { data } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, distance_m, started_at, ended_at, max_speed_mps, paused_duration_s, auto_paused_duration_s, motorcycle_id, motorcycles(name)',
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return undefined;

    const durationS = computeMovingTimeS(
      data.started_at,
      data.ended_at,
      data.paused_duration_s ?? 0,
      data.auto_paused_duration_s ?? 0,
    );

    return {
      id: data.id,
      distanceM: data.distance_m ?? 0,
      durationS,
      maxSpeedMps: data.max_speed_mps ?? undefined,
      date: data.ended_at,
      motorcycleName: (data.motorcycles as any)?.name ?? undefined,
    };
  }

  private async getLast7Days(userId: string): Promise<Last7DaysSummary> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];

    const { data } = await this.supabaseAdmin
      .from('ride_rollups')
      .select('ride_count, distance_m, moving_time_s')
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL)
      .eq('period_kind', 'day')
      .gte('period_start', cutoff);

    if (!data?.length) {
      return { rideCount: 0, distanceM: 0, durationS: 0 };
    }

    return {
      rideCount: data.reduce((sum, r) => sum + (r.ride_count ?? 0), 0),
      distanceM: data.reduce((sum, r) => sum + Number(r.distance_m ?? 0), 0),
      durationS: data.reduce((sum, r) => sum + (r.moving_time_s ?? 0), 0),
    };
  }

  private async getCurrentStreak(userId: string): Promise<number> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);
    const cutoff = twoYearsAgo.toISOString().split('T')[0];

    const { data } = await this.supabaseAdmin
      .from('ride_rollups')
      .select('period_start, ride_count')
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL)
      .eq('period_kind', 'week')
      .gte('period_start', cutoff)
      .gt('ride_count', 0)
      .order('period_start', { ascending: false });

    if (!data?.length) return 0;

    // Count consecutive weeks from the most recent
    let streak = 0;
    const now = new Date();
    // Current ISO week Monday
    const currentMonday = new Date(now);
    currentMonday.setUTCDate(currentMonday.getUTCDate() - ((currentMonday.getUTCDay() + 6) % 7));
    const currentWeekStr = currentMonday.toISOString().split('T')[0];

    // Previous ISO week Monday
    const prevMonday = new Date(currentMonday);
    prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
    const prevWeekStr = prevMonday.toISOString().split('T')[0];

    // The streak is valid if the most recent week-with-ride is current or previous week
    const mostRecent = data[0].period_start;
    if (mostRecent !== currentWeekStr && mostRecent !== prevWeekStr) {
      return 0;
    }

    // Walk backwards counting consecutive weeks
    const expectedDate = new Date(mostRecent);
    for (const row of data) {
      const rowDate = row.period_start;
      const expected = expectedDate.toISOString().split('T')[0];

      if (rowDate === expected) {
        streak++;
        expectedDate.setUTCDate(expectedDate.getUTCDate() - 7);
      } else {
        break;
      }
    }

    return streak;
  }

  private async getPersonalRecords(userId: string): Promise<RideRecord[]> {
    const { data } = await this.supabaseAdmin
      .from('ride_records')
      .select('record_type, value, unit, achieved_at, previous_value, ride_id')
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL)
      .order('achieved_at', { ascending: false });

    if (!data) return [];

    return data.map((r) => ({
      recordType: r.record_type,
      value: r.value,
      unit: r.unit,
      achievedAt: r.achieved_at,
      previousValue: r.previous_value ?? undefined,
      rideId: r.ride_id ?? undefined,
    }));
  }
}
