import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type {
  DailyDistance,
  LastRideSummary,
  RideOverview,
  RidePeriodSummary,
} from './models/ride-overview.model';
import type { RideRecord } from './models/ride-record.model';
import { ALL_BIKES_SENTINEL } from './ride-analytics.constants';
import { computeMovingTimeS } from './ride-analytics.utils';

@Injectable()
export class RideAnalyticsService {
  private readonly logger = new Logger(RideAnalyticsService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient) {}

  async getRideOverview(userId: string): Promise<RideOverview> {
    const [
      lastRide,
      last7Days,
      last30Days,
      thisWeek,
      thisMonth,
      dailyDistances,
      currentStreak,
      personalRecords,
    ] = await Promise.all([
      this.getLastRide(userId),
      this.getLast7Days(userId),
      this.getLast30Days(userId),
      this.getThisWeek(userId),
      this.getThisMonth(userId),
      this.getDailyDistances(userId),
      this.getCurrentStreak(userId),
      this.getPersonalRecords(userId),
    ]);

    return {
      lastRide,
      last7Days,
      last30Days,
      thisWeek,
      thisMonth,
      dailyDistances,
      currentStreak,
      personalRecords,
    };
  }

  private async getLastRide(userId: string): Promise<LastRideSummary | undefined> {
    const { data, error } = await this.supabaseAdmin
      .from('rides')
      .select(
        'id, distance_m, started_at, ended_at, max_speed_mps, paused_duration_s, auto_paused_duration_s, motorcycle_id',
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(`getLastRide query failed: ${error.message} (${error.code})`);
      return undefined;
    }
    if (!data) return undefined;

    const durationS = computeMovingTimeS(
      data.started_at,
      data.ended_at,
      data.paused_duration_s ?? 0,
      data.auto_paused_duration_s ?? 0,
    );

    // Fetch motorcycle name + ride summary in parallel (both non-fatal)
    const [bikeResult, summaryResult] = await Promise.allSettled([
      this.supabaseAdmin
        .from('motorcycles')
        .select('name')
        .eq('id', data.motorcycle_id)
        .maybeSingle(),
      this.supabaseAdmin
        .from('ride_summaries')
        .select('summary_text')
        .eq('ride_id', data.id)
        .maybeSingle(),
    ]);

    const bikeName = bikeResult.status === 'fulfilled' ? bikeResult.value.data?.name : undefined;
    const summaryTitle =
      summaryResult.status === 'fulfilled' ? summaryResult.value.data?.summary_text : undefined;

    return {
      id: data.id,
      distanceM: data.distance_m ?? 0,
      durationS,
      maxSpeedMps: data.max_speed_mps ?? undefined,
      date: data.ended_at,
      motorcycleName: bikeName ?? undefined,
      summaryTitle: summaryTitle ?? undefined,
    };
  }

  private async getLast7Days(userId: string): Promise<RidePeriodSummary> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];

    return this.aggregateRollups(userId, cutoff);
  }

  private async getLast30Days(userId: string): Promise<RidePeriodSummary> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

    return this.aggregateRollups(userId, cutoff);
  }

  private async getThisWeek(userId: string): Promise<RidePeriodSummary> {
    const now = new Date();
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const cutoff = monday.toISOString().split('T')[0];

    return this.aggregateRollups(userId, cutoff);
  }

  private async getThisMonth(userId: string): Promise<RidePeriodSummary> {
    const now = new Date();
    const cutoff = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

    return this.aggregateRollups(userId, cutoff);
  }

  private async getDailyDistances(userId: string): Promise<DailyDistance[]> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);
    const cutoff = fourteenDaysAgo.toISOString().split('T')[0];

    const { data } = await this.supabaseAdmin
      .from('ride_rollups')
      .select('period_start, distance_m')
      .eq('user_id', userId)
      .eq('motorcycle_id', ALL_BIKES_SENTINEL)
      .eq('period_kind', 'day')
      .gte('period_start', cutoff)
      .order('period_start', { ascending: true });

    // Build a full 14-day array with zeros for missing days
    const distanceMap = new Map<string, number>();
    for (const row of data ?? []) {
      distanceMap.set(row.period_start, Number(row.distance_m ?? 0));
    }

    const result: DailyDistance[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({ date: dateStr, distanceM: distanceMap.get(dateStr) ?? 0 });
    }

    return result;
  }

  private async aggregateRollups(userId: string, cutoff: string): Promise<RidePeriodSummary> {
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

    let streak = 0;
    const now = new Date();
    const currentMonday = new Date(now);
    currentMonday.setUTCDate(currentMonday.getUTCDate() - ((currentMonday.getUTCDay() + 6) % 7));
    const currentWeekStr = currentMonday.toISOString().split('T')[0];

    const prevMonday = new Date(currentMonday);
    prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
    const prevWeekStr = prevMonday.toISOString().split('T')[0];

    const mostRecent = data[0].period_start;
    if (mostRecent !== currentWeekStr && mostRecent !== prevWeekStr) {
      return 0;
    }

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
