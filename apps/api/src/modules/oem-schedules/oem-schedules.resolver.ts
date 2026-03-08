import { Inject, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
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

  @Query(() => [OemSchedule])
  @UseGuards(GqlAuthGuard)
  async oemSchedulesForBike(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<OemSchedule[]> {
    // Look up the motorcycle to get make/model/year
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
}
