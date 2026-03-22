import {
  EndRideInputSchema,
  StartRideInputSchema,
  UpdateRideInputSchema,
  UploadWaypointsInputSchema,
} from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { EndRideInput } from './dto/end-ride.input';
import { StartRideInput } from './dto/start-ride.input';
import { UpdateRideInput } from './dto/update-ride.input';
import { UploadWaypointsInput } from './dto/upload-waypoints.input';
import { Ride } from './models/ride.model';
import { RideConnection } from './models/ride-connection.model';
import { RidesService } from './rides.service';

@Resolver(() => Ride)
@UseGuards(GqlAuthGuard)
export class RidesResolver {
  constructor(private readonly ridesService: RidesService) {}

  @Mutation(() => Ride)
  async startRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(StartRideInputSchema)) input: StartRideInput,
  ): Promise<Ride> {
    return this.ridesService.startRide(user.id, input);
  }

  @Mutation(() => Ride)
  async endRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(EndRideInputSchema)) input: EndRideInput,
  ): Promise<Ride> {
    return this.ridesService.endRide(user.id, input);
  }

  @Mutation(() => Int)
  @Throttle({ default: THROTTLE_PRESETS.WAYPOINT_UPLOAD })
  async uploadWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UploadWaypointsInputSchema)) input: UploadWaypointsInput,
  ): Promise<number> {
    return this.ridesService.uploadWaypoints(user.id, input);
  }

  @Mutation(() => Ride)
  async updateRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateRideInputSchema)) input: UpdateRideInput,
  ): Promise<Ride> {
    return this.ridesService.updateRide(user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteRide(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.ridesService.deleteRide(user.id, id);
  }

  @Query(() => RideConnection)
  async myRides(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
    @Args('motorcycleId', { nullable: true }) motorcycleId?: string,
  ): Promise<RideConnection> {
    return this.ridesService.myRides(user.id, first, after, motorcycleId);
  }

  @Query(() => Ride)
  async ride(@CurrentUser() user: AuthUser, @Args('id', ParseUUIDPipe) id: string): Promise<Ride> {
    return this.ridesService.findById(user.id, id);
  }
}
