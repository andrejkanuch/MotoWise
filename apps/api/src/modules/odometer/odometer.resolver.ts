import { LogOdometerReadingSchema } from '@motovault/types';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Motorcycle } from '../motorcycles/models/motorcycle.model';
import { LogOdometerReadingInput } from './dto/log-odometer-reading.input';
import { OdometerReading } from './models/odometer-reading.model';
import { PendingRideDistance } from './models/pending-ride-distance.model';
import { ODOMETER_READINGS_DEFAULT_LIMIT, OdometerService } from './odometer.service';

@Resolver()
export class OdometerResolver {
  constructor(private readonly odometerService: OdometerService) {}

  @Query(() => [OdometerReading])
  async odometerReadings(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
    @Args('limit', { type: () => Int, defaultValue: ODOMETER_READINGS_DEFAULT_LIMIT })
    limit: number,
  ): Promise<OdometerReading[]> {
    return this.odometerService.findReadings(user.id, motorcycleId, limit);
  }

  @Query(() => PendingRideDistance)
  async pendingRideDistance(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<PendingRideDistance> {
    return this.odometerService.pendingRideDistance(user.id, motorcycleId);
  }

  @Mutation(() => Motorcycle)
  async logOdometerReading(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(LogOdometerReadingSchema))
    input: LogOdometerReadingInput,
  ): Promise<Motorcycle> {
    return this.odometerService.logReading(user.id, input);
  }
}
