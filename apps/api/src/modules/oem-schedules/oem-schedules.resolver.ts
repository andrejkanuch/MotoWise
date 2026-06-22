import { ApproveMaintenanceDraftInputSchema } from '@motovault/types';
import { Inject } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { ApproveMaintenanceDraftInput } from './dto/approve-maintenance-draft.input';
import { MaintenanceDraftReview } from './models/maintenance-draft.model';
import { OemSchedule } from './models/oem-schedule.model';
import { OemSchedulesService } from './oem-schedules.service';

@Resolver(() => OemSchedule)
export class OemSchedulesResolver {
  constructor(
    private readonly oemSchedulesService: OemSchedulesService,
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Preview OEM schedules for a make/model/year[/variant] combination — used by onboarding
   * before the motorcycle exists in the database. Authenticated (no @Public); the verification
   * gate in the service ensures drafts never appear here.
   */
  @Query(() => [OemSchedule], { name: 'oemSchedulesPreview' })
  async oemSchedulesPreview(
    @Args('make') make: string,
    @Args('model', { nullable: true }) model?: string,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
    @Args('variant', { nullable: true }) variant?: string,
  ): Promise<OemSchedule[]> {
    return this.oemSchedulesService.findByMotorcycle(
      make,
      model ?? null,
      year ?? null,
      null,
      variant ?? null,
    );
  }

  @Query(() => [OemSchedule])
  async oemSchedulesForBike(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<OemSchedule[]> {
    const { data: motorcycle, error } = await this.supabase
      .from('motorcycles')
      .select('make, model, year, variant')
      .eq('id', motorcycleId)
      .eq('user_id', user.id)
      .single();

    if (error || !motorcycle) {
      return [];
    }

    return this.oemSchedulesService.findByMotorcycle(
      motorcycle.make,
      motorcycle.model ?? null,
      motorcycle.year ?? null,
      null,
      motorcycle.variant ?? null,
    );
  }

  /**
   * MOT-138: Manually (re-)import the OEM maintenance schedule for a bike.
   * Idempotent — existing tasks keyed by oem_schedule_id are skipped, so
   * calling this repeatedly only inserts missing tasks. Returns the count
   * of newly-created tasks so the UI can show "Imported N tasks".
   */
  @Mutation(() => Int, { name: 'importOemSchedule' })
  async importOemSchedule(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<number> {
    const { data: motorcycle } = await this.supabase
      .from('motorcycles')
      .select('make, model, year, variant, engine_cc, current_mileage')
      .eq('id', motorcycleId)
      .eq('user_id', user.id)
      .single();

    if (!motorcycle) return 0;

    return this.oemSchedulesService.autoPopulateForBike(
      this.supabase,
      user.id,
      motorcycleId,
      motorcycle.make,
      motorcycle.model ?? null,
      motorcycle.year ?? null,
      motorcycle.engine_cc ?? null,
      motorcycle.current_mileage ?? 0,
      undefined,
      motorcycle.variant ?? null,
    );
  }

  /**
   * Admin-only: list pending maintenance drafts (unverified, sourced rows + specs) joined to
   * their source document, for the verification review page (U4). Authorization is a DB role
   * check inside the service — the route proxy gate is not sufficient for safety-critical data.
   */
  @Query(() => MaintenanceDraftReview, { name: 'maintenanceDraftReview' })
  async maintenanceDraftReview(@CurrentUser() user: AuthUser): Promise<MaintenanceDraftReview> {
    return this.oemSchedulesService.listMaintenanceDrafts(user.id);
  }

  /**
   * Admin-only: approve a single draft row (sets is_verified=true, verified_by, verified_at).
   * Per-row by design; bulk "approve all non-critical" is N calls from the UI.
   */
  @Mutation(() => Boolean, { name: 'approveMaintenanceDraft' })
  async approveMaintenanceDraft(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(ApproveMaintenanceDraftInputSchema))
    input: ApproveMaintenanceDraftInput,
  ): Promise<boolean> {
    return this.oemSchedulesService.approveMaintenanceDraft(user.id, {
      kind: input.kind as 'schedule' | 'spec',
      id: input.id,
    });
  }
}
