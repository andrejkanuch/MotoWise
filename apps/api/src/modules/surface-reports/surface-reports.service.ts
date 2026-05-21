import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from '@upstash/redis';
import { REDIS } from '../redis/redis.constants';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { ReportSurfaceInput } from './dto/report-surface.input';
import type {
  ConditionAggregate,
  RouteConditions,
  SurfaceReport,
} from './models/surface-report.model';

/** Cache TTL for aggregates: 5 minutes */
const AGGREGATE_CACHE_TTL = 300;

interface SurfaceReportRow {
  id: string;
  route_id: string;
  user_id: string;
  reported_at: string;
  condition: string;
  note: string | null;
  photo_url: string | null;
}

@Injectable()
export class SurfaceReportsService {
  private readonly logger = new Logger(SurfaceReportsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  async reportSurface(userId: string, input: ReportSurfaceInput): Promise<SurfaceReport> {
    const { data, error } = await this.supabase
      .from('surface_reports')
      .insert({
        route_id: input.routeId,
        user_id: userId,
        condition: input.condition,
        note: input.note ?? null,
        photo_url: input.photoUrl ?? null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to insert surface report: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    const row = data as SurfaceReportRow;

    // Invalidate cached aggregates for this route
    await this.invalidateAggregateCache(input.routeId);

    return this.mapRow(row);
  }

  async routeConditions(routeId: string): Promise<RouteConditions> {
    const [recentReports, aggregates] = await Promise.all([
      this.getRecentReports(routeId),
      this.getAggregates(routeId),
    ]);

    return { recentReports, aggregates };
  }

  private async getRecentReports(routeId: string): Promise<SurfaceReport[]> {
    const { data, error } = await this.supabase
      .from('surface_reports')
      .select('*')
      .eq('route_id', routeId)
      .order('reported_at', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.error(`Failed to fetch recent reports: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    return (data as SurfaceReportRow[]).map((row) => this.mapRow(row));
  }

  private async getAggregates(routeId: string): Promise<ConditionAggregate[]> {
    const cacheKey = `surface_agg:${routeId}`;

    // Try cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get<ConditionAggregate[]>(cacheKey);
        if (cached) return cached;
      } catch (err) {
        this.logger.warn(`Redis cache read failed: ${err}`);
      }
    }

    // 30-day aggregates via raw query
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('surface_reports')
      .select('condition')
      .eq('route_id', routeId)
      .gte('reported_at', thirtyDaysAgo);

    if (error) {
      this.logger.error(`Failed to fetch aggregates: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    // Count conditions in-memory
    const counts = new Map<string, number>();
    for (const row of data as { condition: string }[]) {
      counts.set(row.condition, (counts.get(row.condition) ?? 0) + 1);
    }

    const aggregates: ConditionAggregate[] = Array.from(counts.entries())
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count);

    // Cache the result
    if (this.redis) {
      try {
        await this.redis.set(cacheKey, aggregates, { ex: AGGREGATE_CACHE_TTL });
      } catch (err) {
        this.logger.warn(`Redis cache write failed: ${err}`);
      }
    }

    return aggregates;
  }

  private async invalidateAggregateCache(routeId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`surface_agg:${routeId}`);
    } catch (err) {
      this.logger.warn(`Redis cache invalidation failed: ${err}`);
    }
  }

  private mapRow(row: SurfaceReportRow): SurfaceReport {
    return {
      id: row.id,
      routeId: row.route_id,
      userId: row.user_id,
      reportedAt: row.reported_at,
      condition: row.condition,
      note: row.note ?? undefined,
      photoUrl: row.photo_url ?? undefined,
    };
  }
}
