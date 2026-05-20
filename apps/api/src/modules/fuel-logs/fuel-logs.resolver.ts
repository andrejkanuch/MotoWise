import { CreateFuelLogSchema } from '@motovault/types';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateFuelLogInput } from './dto/create-fuel-log.input';
import { FuelLogsService } from './fuel-logs.service';
import { FuelLog } from './models/fuel-log.model';

@Resolver(() => FuelLog)
export class FuelLogsResolver {
  constructor(private readonly fuelLogsService: FuelLogsService) {}

  @Query(() => [FuelLog])
  async fuelLogs(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<FuelLog[]> {
    return this.fuelLogsService.listByMotorcycle(user.id, motorcycleId);
  }

  @Mutation(() => FuelLog)
  async createFuelLog(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateFuelLogSchema)) input: CreateFuelLogInput,
  ): Promise<FuelLog> {
    return this.fuelLogsService.create(user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteFuelLog(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.fuelLogsService.softDelete(user.id, id);
  }
}
