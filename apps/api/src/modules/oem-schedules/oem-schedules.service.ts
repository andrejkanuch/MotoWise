import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { GqlMaintenancePriority } from '../../common/enums/graphql-enums';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { OemSchedule } from './models/oem-schedule.model';

@Injectable()
export class OemSchedulesService {
  private readonly logger = new Logger(OemSchedulesService.name);
  private readonly previewCache = new Map<string, { data: OemSchedule[]; expiresAt: number }>();
  private static readonly PREVIEW_TTL = 3_600_000; // 1 hour

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  async findByMotorcycle(
    make: string,
    model: string | null,
    year: number | null,
    engineCc: number | null,
  ): Promise<OemSchedule[]> {
    const cacheKey = `${make}|${model ?? ''}|${year ?? ''}|${engineCc ?? ''}`;
    const cached = this.previewCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Level 1: exact model + year match (case-insensitive on make)
    if (model) {
      let query = this.supabase
        .from('oem_maintenance_schedules')
        .select('*')
        .eq('make', make.toUpperCase())
        .eq('model', model);

      if (year != null) {
        if (!Number.isFinite(year)) {
          throw new BadRequestException('year must be a finite number');
        }
        query = query
          .or(`year_from.is.null,year_from.lte.${year}`)
          .or(`year_to.is.null,year_to.gte.${year}`);
      }

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Failed to fetch OEM schedules (level 1)', error.message);
      }

      if (data && data.length > 0) {
        const result = this.filterByEngine(data, engineCc).map((row) => this.mapRow(row));
        this.previewCache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + OemSchedulesService.PREVIEW_TTL,
        });
        return result;
      }
    }

    // Level 2: make-level (model IS NULL, case-insensitive on make)
    {
      const { data, error } = await this.supabase
        .from('oem_maintenance_schedules')
        .select('*')
        .eq('make', make.toUpperCase())
        .is('model', null)
        .order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Failed to fetch OEM schedules (level 2)', error.message);
      }

      if (data && data.length > 0) {
        const result = this.filterByEngine(data, engineCc).map((row) => this.mapRow(row));
        this.previewCache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + OemSchedulesService.PREVIEW_TTL,
        });
        return result;
      }
    }

    // Level 3: GENERIC fallback
    {
      const { data, error } = await this.supabase
        .from('oem_maintenance_schedules')
        .select('*')
        .eq('make', 'GENERIC')
        .is('model', null)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new InternalServerErrorException('Failed to fetch OEM schedules');
      }

      const result = (data ?? []).map((row) => this.mapRow(row));
      this.previewCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + OemSchedulesService.PREVIEW_TTL,
      });
      return result;
    }
  }

  /**
   * Auto-populate OEM maintenance tasks for a motorcycle.
   *
   * @param supabaseUser  Per-request user client — used for the maintenance_tasks INSERT (RLS enforced)
   * @param userId        Owner of the motorcycle
   * @param motorcycleId  Target motorcycle
   * @param make          Motorcycle make (used for schedule lookup when no filter provided)
   * @param model         Motorcycle model (used for schedule lookup when no filter provided)
   * @param year          Motorcycle year (used for schedule lookup when no filter provided)
   * @param engineCc      Engine displacement (used for schedule lookup when no filter provided)
   * @param currentMileage Current odometer reading
   * @param scheduleIdFilter When provided, fetch schedules by primary key instead of the 3-level
   *                         make/model/year waterfall — used by onboarding where the user already
   *                         selected specific schedule IDs.
   */
  async autoPopulateForBike(
    supabaseUser: SupabaseClient,
    userId: string,
    motorcycleId: string,
    make: string,
    model: string | null,
    year: number | null,
    engineCc: number | null,
    currentMileage = 0,
    scheduleIdFilter?: string[],
  ): Promise<number> {
    // Resolve schedules: direct PK lookup when filter provided, otherwise 3-level waterfall
    let schedules: OemSchedule[];
    if (scheduleIdFilter && scheduleIdFilter.length > 0) {
      const { data, error } = await this.supabase
        .from('oem_maintenance_schedules')
        .select('*')
        .in('id', scheduleIdFilter)
        .order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Failed to fetch OEM schedules by ID filter', error.message);
        throw new InternalServerErrorException('Failed to fetch OEM maintenance schedules');
      }

      schedules = (data ?? []).map((row) => this.mapRow(row));
    } else {
      schedules = await this.findByMotorcycle(make, model, year, engineCc);
    }

    if (schedules.length === 0) return 0;

    // Check which oem_schedule_ids already exist for this motorcycle (dedup)
    const scheduleIds = schedules.map((s) => s.id);
    const { data: existing } = await this.supabase
      .from('maintenance_tasks')
      .select('oem_schedule_id')
      .eq('motorcycle_id', motorcycleId)
      .in('oem_schedule_id', scheduleIds);

    const existingIds = new Set((existing ?? []).map((row) => row.oem_schedule_id));

    const now = new Date();
    const tasksToInsert = schedules
      .filter((schedule) => !existingIds.has(schedule.id))
      .map((schedule) => {
        const dueDate = schedule.intervalDays
          ? new Date(now.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const targetMileage = schedule.intervalKm ? currentMileage + schedule.intervalKm : null;

        return {
          user_id: userId,
          motorcycle_id: motorcycleId,
          title: schedule.taskName,
          description: schedule.description ?? null,
          due_date: dueDate,
          target_mileage: targetMileage,
          priority: schedule.priority,
          status: 'pending',
          source: 'oem',
          oem_schedule_id: schedule.id,
          interval_km: schedule.intervalKm ?? null,
          interval_days: schedule.intervalDays ?? null,
          is_recurring: true,
        };
      });

    if (tasksToInsert.length === 0) return 0;

    // Use the user-scoped client for the INSERT (RLS enforced)
    const { error } = await supabaseUser.from('maintenance_tasks').insert(tasksToInsert);

    if (error) {
      this.logger.error('Failed to auto-populate maintenance tasks', error.message);
      throw new InternalServerErrorException('Failed to create OEM maintenance tasks');
    }

    this.logger.log(
      `Auto-populated ${tasksToInsert.length} maintenance tasks for motorcycle ${motorcycleId}`,
    );
    return tasksToInsert.length;
  }

  private filterByEngine(
    rows: Record<string, unknown>[],
    engineCc: number | null,
  ): Record<string, unknown>[] {
    if (engineCc == null) return rows;

    return rows.filter((row) => {
      const min = row.engine_cc_min as number | null;
      const max = row.engine_cc_max as number | null;
      if (min != null && engineCc < min) return false;
      if (max != null && engineCc > max) return false;
      return true;
    });
  }

  private mapRow(row: Record<string, unknown>): OemSchedule {
    return {
      id: row.id as string,
      make: row.make as string,
      model: (row.model as string) ?? undefined,
      yearFrom: (row.year_from as number) ?? undefined,
      yearTo: (row.year_to as number) ?? undefined,
      taskName: row.task_name as string,
      description: (row.description as string) ?? undefined,
      intervalKm: (row.interval_km as number) ?? undefined,
      intervalDays: (row.interval_days as number) ?? undefined,
      priority: this.validPriority(row.priority as string),
      engineType: (row.engine_type as string) ?? undefined,
      engineCcMin: (row.engine_cc_min as number) ?? undefined,
      engineCcMax: (row.engine_cc_max as number) ?? undefined,
      sortOrder: (row.sort_order as number) ?? 0,
      createdAt: row.created_at as string,
    };
  }

  private readonly VALID_PRIORITIES = new Set<string>(Object.values(GqlMaintenancePriority));

  private validPriority(value: string): GqlMaintenancePriority {
    if (this.VALID_PRIORITIES.has(value)) {
      return value as GqlMaintenancePriority;
    }
    this.logger.warn(`Invalid OEM schedule priority "${value}", defaulting to medium`);
    return GqlMaintenancePriority.medium;
  }
}
