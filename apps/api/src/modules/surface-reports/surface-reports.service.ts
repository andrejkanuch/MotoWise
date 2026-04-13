import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

export interface SurfaceReport {
  id: string;
  routeId: string;
  userId: string;
  condition: string;
  note: string | null;
  reportedAt: string;
}

export interface RouteConditionAggregate {
  condition: string;
  count: number;
  latestReportedAt: string;
}

@Injectable()
export class SurfaceReportsService {
  private readonly logger = new Logger(SurfaceReportsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async reportSurface(
    userId: string,
    input: { routeId: string; condition: string; note?: string },
  ): Promise<SurfaceReport> {
    const today = new Date().toISOString().slice(0, 10);

    // Check for duplicate report on the same day
    const { data: existing } = await this.supabase
      .from('surface_reports')
      .select('id')
      .eq('route_id', input.routeId)
      .eq('user_id', userId)
      .gte('reported_at', `${today}T00:00:00Z`)
      .lte('reported_at', `${today}T23:59:59Z`)
      .single();

    if (existing) {
      throw new BadRequestException('You have already reported surface conditions for this route today');
    }

    const { data, error } = await this.supabase
      .from('surface_reports')
      .insert({
        route_id: input.routeId,
        user_id: userId,
        condition: input.condition,
        note: input.note ?? null,
      })
      .select('id, route_id, user_id, condition, note, reported_at')
      .single();

    if (error) {
      this.logger.error(`reportSurface failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to create surface report');
    }

    return {
      id: data.id,
      routeId: data.route_id,
      userId: data.user_id,
      condition: data.condition,
      note: data.note,
      reportedAt: data.reported_at,
    };
  }

  async routeConditions(routeId: string): Promise<RouteConditionAggregate[]> {
    const { data, error } = await this.supabaseAdmin
      .from('surface_reports')
      .select('condition, reported_at')
      .eq('route_id', routeId)
      .order('reported_at', { ascending: false });

    if (error) {
      this.logger.error(`routeConditions failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch route conditions');
    }

    const rows = data ?? [];
    const aggregateMap = new Map<string, { count: number; latestReportedAt: string }>();

    for (const row of rows) {
      const existing = aggregateMap.get(row.condition);
      if (existing) {
        existing.count++;
      } else {
        aggregateMap.set(row.condition, {
          count: 1,
          latestReportedAt: row.reported_at,
        });
      }
    }

    return Array.from(aggregateMap.entries()).map(([condition, agg]) => ({
      condition,
      count: agg.count,
      latestReportedAt: agg.latestReportedAt,
    }));
  }
}
