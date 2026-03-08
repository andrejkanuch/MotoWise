import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { OemSchedule } from './models/oem-schedule.model';

@Injectable()
export class OemSchedulesService {
  private readonly logger = new Logger(OemSchedulesService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  async findByMotorcycle(
    make: string,
    model: string | null,
    year: number | null,
    engineCc: number | null,
  ): Promise<OemSchedule[]> {
    // Level 1: exact model + year match
    if (model) {
      let query = this.supabase
        .from('oem_maintenance_schedules')
        .select('*')
        .eq('make', make)
        .eq('model', model);

      if (year != null) {
        query = query
          .or(`year_from.is.null,year_from.lte.${year}`)
          .or(`year_to.is.null,year_to.gte.${year}`);
      }

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Failed to fetch OEM schedules (level 1)', error.message);
      }

      if (data && data.length > 0) {
        return this.filterByEngine(data, engineCc).map((row) => this.mapRow(row));
      }
    }

    // Level 2: make-level (model IS NULL)
    {
      const { data, error } = await this.supabase
        .from('oem_maintenance_schedules')
        .select('*')
        .eq('make', make)
        .is('model', null)
        .order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Failed to fetch OEM schedules (level 2)', error.message);
      }

      if (data && data.length > 0) {
        return this.filterByEngine(data, engineCc).map((row) => this.mapRow(row));
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

      return (data ?? []).map((row) => this.mapRow(row));
    }
  }

  async autoPopulateForBike(
    userId: string,
    motorcycleId: string,
    make: string,
    model: string | null,
    year: number | null,
    engineCc: number | null,
    currentMileage = 0,
  ): Promise<number> {
    const schedules = await this.findByMotorcycle(make, model, year, engineCc);

    if (schedules.length === 0) return 0;

    // Check which oem_schedule_ids already exist for this motorcycle
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

    const { error } = await this.supabase.from('maintenance_tasks').insert(tasksToInsert);

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
      priority: row.priority as string,
      engineType: (row.engine_type as string) ?? undefined,
      engineCcMin: (row.engine_cc_min as number) ?? undefined,
      engineCcMax: (row.engine_cc_max as number) ?? undefined,
      sortOrder: (row.sort_order as number) ?? 0,
      createdAt: row.created_at as string,
    };
  }
}
