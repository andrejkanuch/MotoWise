import { Inject } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { OemSchedule } from './models/oem-schedule.model';
import { OemSchedulesService } from './oem-schedules.service';

@Resolver(() => OemSchedule)
export class OemSchedulesResolver {
  constructor(
    private readonly oemSchedulesService: OemSchedulesService,
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Preview OEM schedules for a make/model/year combination — used by onboarding
   * swipe screen before the motorcycle exists in the database.
   */
  @Query(() => [OemSchedule], { name: 'oemSchedulesPreview' })
  async oemSchedulesPreview(
    @Args('make') make: string,
    @Args('model', { nullable: true }) model?: string,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
  ): Promise<OemSchedule[]> {
    return this.oemSchedulesService.findByMotorcycle(make, model ?? null, year ?? null, null);
  }

  @Query(() => [OemSchedule])
  async oemSchedulesForBike(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<OemSchedule[]> {
    const { data: motorcycle, error } = await this.supabase
      .from('motorcycles')
      .select('make, model, year')
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
      .select('make, model, year, engine_cc, current_mileage')
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
    );
  }
}
