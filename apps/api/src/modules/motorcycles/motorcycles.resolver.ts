import { CreateMotorcycleSchema, UpdateMotorcycleSchema } from '@motovault/types';
import { Inject, Logger } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OemSchedulesService } from '../oem-schedules/oem-schedules.service';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { CreateMotorcycleInput } from './dto/create-motorcycle.input';
import { UpdateMotorcycleInput } from './dto/update-motorcycle.input';
import { MakeStats } from './models/make-stats.model';
import { Motorcycle } from './models/motorcycle.model';
import { MotorcycleMake } from './models/motorcycle-make.model';
import { MotorcycleModelResult } from './models/motorcycle-model-result.model';
import { RecallResult } from './models/recall.model';
import { MotorcyclesService } from './motorcycles.service';
import { NhtsaService } from './nhtsa.service';

@Resolver(() => Motorcycle)
export class MotorcyclesResolver {
  private readonly logger = new Logger(MotorcyclesResolver.name);

  constructor(
    private readonly motorcyclesService: MotorcyclesService,
    private readonly nhtsaService: NhtsaService,
    private readonly oemSchedulesService: OemSchedulesService,
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
  ) {}

  @Query(() => [Motorcycle])
  async myMotorcycles(@CurrentUser() user: AuthUser): Promise<Motorcycle[]> {
    return this.motorcyclesService.findByUser(user.id);
  }

  @Query(() => [MotorcycleMake], { name: 'motorcycleMakes' })
  async motorcycleMakes(): Promise<MotorcycleMake[]> {
    return this.nhtsaService.getMakes();
  }

  @Query(() => [MotorcycleModelResult], { name: 'motorcycleModels' })
  async motorcycleModels(
    @Args('makeId', { type: () => Int }) makeId: number,
    @Args('year', { type: () => Int }) year: number,
  ): Promise<MotorcycleModelResult[]> {
    return this.nhtsaService.getModels(makeId, year);
  }

  @Query(() => [MakeStats], {
    name: 'makeStats',
    description: 'Aggregated fleet stats per motorcycle make (riders, models, total bikes)',
  })
  async makeStats(): Promise<MakeStats[]> {
    return this.motorcyclesService.getMakeStats();
  }

  @Mutation(() => Motorcycle)
  async createMotorcycle(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateMotorcycleSchema)) input: CreateMotorcycleInput,
  ): Promise<Motorcycle> {
    const motorcycle = await this.motorcyclesService.create(user.id, input);

    // Auto-populate OEM maintenance tasks in the background
    try {
      await this.oemSchedulesService.autoPopulateForBike(
        this.supabase,
        user.id,
        motorcycle.id,
        motorcycle.make,
        motorcycle.model ?? null,
        motorcycle.year ?? null,
        null,
      );
    } catch (err) {
      // Don't fail motorcycle creation if auto-populate fails
      this.logger.error('Failed to auto-populate OEM tasks', err);
    }

    return motorcycle;
  }

  @Mutation(() => Motorcycle)
  async updateMotorcycle(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('input', new ZodValidationPipe(UpdateMotorcycleSchema)) input: UpdateMotorcycleInput,
  ): Promise<Motorcycle> {
    return this.motorcyclesService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  async deleteMotorcycle(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.motorcyclesService.softDelete(user.id, id);
  }

  // MOT-142: Check open NHTSA safety recalls for a motorcycle.
  @Query(() => RecallResult, { name: 'motorcycleRecalls' })
  async motorcycleRecalls(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<RecallResult> {
    return this.motorcyclesService.checkRecalls(user.id, motorcycleId);
  }
}
