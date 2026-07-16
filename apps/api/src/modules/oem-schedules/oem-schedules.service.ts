import type { ApproveMaintenanceDraftInput } from '@motovault/types';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { GqlMaintenancePriority } from '../../common/enums/graphql-enums';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import {
  AdminMotorcycleSpecDraft,
  AdminOemScheduleDraft,
  MaintenanceDraftReview,
} from './models/maintenance-draft.model';
import { OemSchedule } from './models/oem-schedule.model';

@Injectable()
export class OemSchedulesService {
  private readonly logger = new Logger(OemSchedulesService.name);
  private readonly previewCache = new Map<string, { data: OemSchedule[]; expiresAt: number }>();
  private static readonly PREVIEW_TTL = 3_600_000; // 1 hour

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  /**
   * THE verification gate (plan U3 / KTD 3): the single, only source of `oem_maintenance_schedules`
   * reads on every live path. `is_verified = true` is applied here once — existing baseline rows
   * were backfilled to true in migration 00149 (so no regression); new draft rows (is_verified=false)
   * are excluded until approved. Every tier of findByMotorcycle AND the autoPopulateForBike PK
   * branch build on this, so the gate can never drift across paths.
   */
  private verifiedSchedules() {
    return this.supabase.from('oem_maintenance_schedules').select('*').eq('is_verified', true);
  }

  /** Year-range predicate shared by the model-level tiers. */
  private applyYearRange<T extends { or(filter: string): T }>(query: T, year: number | null): T {
    if (year == null) return query;
    return query
      .or(`year_from.is.null,year_from.lte.${year}`)
      .or(`year_to.is.null,year_to.gte.${year}`);
  }

  private cacheSet(key: string, data: OemSchedule[]): OemSchedule[] {
    this.previewCache.set(key, { data, expiresAt: Date.now() + OemSchedulesService.PREVIEW_TTL });
    return data;
  }

  /** Fetch verified model-level rows for a specific variant (`null` = the variant-agnostic baseline). */
  private async queryModelRows(
    makeUpper: string,
    model: string,
    variant: string | null,
    year: number | null,
  ): Promise<Record<string, unknown>[]> {
    let query = this.verifiedSchedules().eq('make', makeUpper).eq('model', model);
    query = variant === null ? query.is('variant', null) : query.eq('variant', variant);
    query = this.applyYearRange(query, year);
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) {
      this.logger.error(
        `Failed to fetch OEM schedules (model${variant ? `+${variant}` : ' baseline'})`,
        error.message,
      );
    }
    return data ?? [];
  }

  /**
   * Merge variant-specific rows over the variant-agnostic baseline by `task_name` (variant wins),
   * preserving baseline tasks that have no variant entry. Result is ordered by `sort_order`.
   */
  private mergeRowsByTaskName(
    baseline: Record<string, unknown>[],
    variantRows: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    if (variantRows.length === 0) return baseline;
    const byTask = new Map<string, Record<string, unknown>>();
    for (const row of baseline) byTask.set(row.task_name as string, row);
    for (const row of variantRows) byTask.set(row.task_name as string, row); // variant overrides
    return [...byTask.values()].sort(
      (a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0),
    );
  }

  /**
   * Resolve OEM schedules via the verified waterfall (gate applied per-row in every tier):
   *   1. verified make + model + variant   (only when a variant is supplied)
   *   2. verified make + model (variant-agnostic rows, variant IS NULL)
   *   3. make-generic baseline (model IS NULL)
   *   4. GENERIC fallback
   */
  async findByMotorcycle(
    make: string,
    model: string | null,
    year: number | null,
    engineCc: number | null,
    variant: string | null = null,
  ): Promise<OemSchedule[]> {
    const cacheKey = `${make}|${model ?? ''}|${variant ?? ''}|${year ?? ''}|${engineCc ?? ''}`;
    const cached = this.previewCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    if (year != null && !Number.isFinite(year)) {
      throw new BadRequestException('year must be a finite number');
    }

    const makeUpper = make.toUpperCase();
    const finalize = (rows: Record<string, unknown>[]): OemSchedule[] =>
      this.cacheSet(
        cacheKey,
        this.filterByEngine(rows, engineCc).map((row) => this.mapRow(row)),
      );

    // Model level (tier 1 + tier 2 merged): variant-specific rows OVERRIDE variant-agnostic
    // (variant IS NULL) baseline rows per task_name, but baseline tasks WITHOUT a variant-specific
    // entry are still included — so a DCT bike gets its DCT-specific rows AND keeps generic tasks.
    // (Audit P2: a variant hit must not short-circuit and hide the variant-null baseline.)
    if (model) {
      const baseline = await this.queryModelRows(makeUpper, model, null, year);
      const variantRows = variant ? await this.queryModelRows(makeUpper, model, variant, year) : [];
      const merged = this.mergeRowsByTaskName(baseline, variantRows);
      if (merged.length > 0) return finalize(merged);
    }

    // Tier 3: make-generic baseline (model IS NULL)
    {
      const { data, error } = await this.verifiedSchedules()
        .eq('make', makeUpper)
        .is('model', null)
        .order('sort_order', { ascending: true });
      if (error) {
        this.logger.error('Failed to fetch OEM schedules (tier 3: make-generic)', error.message);
      }
      if (data && data.length > 0) return finalize(data);
    }

    // Tier 4: GENERIC fallback
    {
      const { data, error } = await this.verifiedSchedules()
        .eq('make', 'GENERIC')
        .is('model', null)
        .order('sort_order', { ascending: true });
      if (error) {
        throw new InternalServerErrorException('Failed to fetch OEM schedules');
      }
      return finalize(data ?? []);
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
   * @param scheduleIdFilter When provided, fetch schedules by primary key instead of the
   *                         make/model/variant/year waterfall — used by onboarding where the user
   *                         already selected specific schedule IDs. The verification gate is
   *                         applied here too, so a draft id cannot be imported directly.
   * @param variant        Motorcycle variant (e.g. 'DCT') threaded into the waterfall.
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
    variant: string | null = null,
  ): Promise<number> {
    // Resolve schedules: direct PK lookup when filter provided, otherwise the verified waterfall.
    let schedules: OemSchedule[];
    if (scheduleIdFilter && scheduleIdFilter.length > 0) {
      // Gate the PK branch too — a draft id passed here must NOT import (plan U3 P0 coverage).
      const { data, error } = await this.verifiedSchedules()
        .in('id', scheduleIdFilter)
        .order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Failed to fetch OEM schedules by ID filter', error.message);
        throw new InternalServerErrorException('Failed to fetch OEM maintenance schedules');
      }

      schedules = (data ?? []).map((row) => this.mapRow(row));
    } else {
      schedules = await this.findByMotorcycle(make, model, year, engineCc, variant);
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
        // currentMileage and schedule.intervalKm are both canonical KILOMETRES
        // (docs/plans/odometer-unit-normalization.md) — unit-safe addition.
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

  // ==========================================================================
  // Admin review (U3) — draft listing + approval. Authorized by a DB role
  // check via SUPABASE_ADMIN; the JWT `role` claim is informational only.
  // ==========================================================================

  private async assertAdmin(userId: string): Promise<void> {
    const { data: caller } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    if (caller?.role !== 'admin') throw new ForbiddenException('Admin only');
  }

  /** List pending (unverified, sourced) drafts joined to their source document. */
  async listMaintenanceDrafts(userId: string): Promise<MaintenanceDraftReview> {
    await this.assertAdmin(userId);

    const { data: scheduleRows, error: schedErr } = await this.supabase
      .from('oem_maintenance_schedules')
      .select('*, maintenance_data_sources(title, source_url)')
      .eq('is_verified', false)
      .not('source_id', 'is', null)
      .order('created_at', { ascending: true });
    if (schedErr) {
      this.logger.error('Failed to list schedule drafts', schedErr.message);
      throw new InternalServerErrorException('Failed to list maintenance drafts');
    }

    const { data: specRows, error: specErr } = await this.supabase
      .from('motorcycle_specs')
      .select('*, maintenance_data_sources(title, source_url)')
      .eq('is_verified', false)
      .not('source_id', 'is', null)
      .order('created_at', { ascending: true });
    if (specErr) {
      this.logger.error('Failed to list spec drafts', specErr.message);
      throw new InternalServerErrorException('Failed to list maintenance drafts');
    }

    return {
      schedules: (scheduleRows ?? []).map((row) => this.mapAdminScheduleRow(row)),
      specs: (specRows ?? []).map((row) => this.mapAdminSpecRow(row)),
    };
  }

  /**
   * Approve a single draft row (per-row; bulk non-critical = N calls from the UI).
   *
   * RLS-footgun exception (documented per CLAUDE.md Supabase Client Rules): this write uses
   * SUPABASE_ADMIN because `oem_maintenance_schedules`/`motorcycle_specs` are reference tables
   * with deny-all RLS (service-role-only) — there is no user-owned RLS author check to bypass.
   * Authorization is enforced app-layer by `assertAdmin` (a DB role check) above.
   */
  async approveMaintenanceDraft(
    userId: string,
    input: ApproveMaintenanceDraftInput,
  ): Promise<boolean> {
    await this.assertAdmin(userId);

    const table = input.kind === 'spec' ? 'motorcycle_specs' : 'oem_maintenance_schedules';
    // `is_verified = false` guard makes re-approving a no-op-by-rejection (a second concurrent
    // approve matches no pending row) so verified_by/verified_at are stamped exactly once.
    const { data, error } = await this.supabase
      .from(table)
      .update({
        is_verified: true,
        verified_by: userId,
        verified_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('is_verified', false)
      .select('id')
      .single();

    if (error || !data) throw new NotFoundException('Draft not found');

    // The verified set changed — invalidate the preview cache so drafts/approvals surface.
    this.previewCache.clear();
    return true;
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

  /** Public type mapping — verification/provenance fields intentionally NOT exposed. */
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

  private sourceTitle(row: Record<string, unknown>): string | undefined {
    const source = row.maintenance_data_sources as { title?: string } | null;
    return source?.title ?? undefined;
  }

  private mapAdminScheduleRow(row: Record<string, unknown>): AdminOemScheduleDraft {
    return {
      id: row.id as string,
      make: row.make as string,
      model: (row.model as string) ?? undefined,
      variant: (row.variant as string) ?? undefined,
      taskName: row.task_name as string,
      intervalKm: (row.interval_km as number) ?? undefined,
      intervalDays: (row.interval_days as number) ?? undefined,
      priority: this.validPriority(row.priority as string),
      isSafetyCritical: Boolean(row.is_safety_critical),
      sourcePage: (row.source_page as string) ?? undefined,
      sourceContext: (row.source_context as string) ?? undefined,
      sourceTitle: this.sourceTitle(row),
      createdAt: row.created_at as string,
    };
  }

  private mapAdminSpecRow(row: Record<string, unknown>): AdminMotorcycleSpecDraft {
    return {
      id: row.id as string,
      make: row.make as string,
      model: (row.model as string) ?? undefined,
      variant: (row.variant as string) ?? undefined,
      specType: row.spec_type as string,
      specName: row.spec_name as string,
      valueNumeric: Number(row.value_numeric),
      valueDisplay: (row.value_display as string) ?? undefined,
      unit: row.unit as string,
      isSafetyCritical: Boolean(row.is_safety_critical),
      sourcePage: (row.source_page as string) ?? undefined,
      sourceContext: (row.source_context as string) ?? undefined,
      sourceTitle: this.sourceTitle(row),
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
