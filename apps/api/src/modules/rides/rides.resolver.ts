import {
  EndRideInputSchema,
  StartRideInputSchema,
  UpdateRideInputSchema,
  UploadWaypointsInputSchema,
} from '@motovault/types';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EndRideInput } from './dto/end-ride.input';
import { StartRideInput } from './dto/start-ride.input';
import { UpdateRideInput } from './dto/update-ride.input';
import { UploadWaypointsInput } from './dto/upload-waypoints.input';
import { EndRideResponse } from './models/end-ride-response.model';
import { Ride } from './models/ride.model';
import { RideConnection } from './models/ride-connection.model';
import { Waypoint } from './models/waypoint.model';
import { RidesService } from './rides.service';

@Resolver(() => Ride)
export class RidesResolver {
  constructor(private readonly ridesService: RidesService) {}

  @Mutation(() => Ride)
  async startRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(StartRideInputSchema)) input: StartRideInput,
  ): Promise<Ride> {
    return this.ridesService.startRide(user.id, input);
  }

  @Mutation(() => EndRideResponse)
  async endRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(EndRideInputSchema)) input: EndRideInput,
  ): Promise<EndRideResponse> {
    return this.ridesService.endRide(user.id, input);
  }

  @Mutation(() => Int)
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

  @Query(() => Ride)
  @Public()
  async getPublicRide(@Args('id', ParseUUIDPipe) id: string): Promise<Ride> {
    return this.ridesService.getPublicRide(id);
  }

  @Query(() => [Waypoint])
  async rideWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
    @Args('maxPoints', { type: () => Int, nullable: true }) maxPoints?: number,
  ): Promise<Waypoint[]> {
    return this.ridesService.findWaypoints(user.id, rideId, maxPoints);
  }

  // ==========================================
  // Ride visibility + sharing (privacy feature)
  // ==========================================

  @Mutation(() => Ride)
  async updateRideVisibility(
    @CurrentUser() user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
    @Args('visibility') visibility: string,
  ): Promise<Ride> {
    // Validate the enum at the resolver boundary — DTO would be heavier
    // than a 3-value union check here.
    if (!['private', 'unlisted', 'public'].includes(visibility)) {
      throw new Error(`Invalid visibility: ${visibility}`);
    }
    return this.ridesService.updateRideVisibility(
      user.id,
      rideId,
      visibility as 'private' | 'unlisted' | 'public',
    );
  }

  @Mutation(() => Boolean)
  async shareRide(
    @CurrentUser() user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
    @Args('sharedWithUserId', ParseUUIDPipe) sharedWithUserId: string,
  ): Promise<boolean> {
    return this.ridesService.shareRide(user.id, rideId, sharedWithUserId);
  }

  @Mutation(() => Boolean)
  async unshareRide(
    @CurrentUser() user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
    @Args('sharedWithUserId', ParseUUIDPipe) sharedWithUserId: string,
  ): Promise<boolean> {
    return this.ridesService.unshareRide(user.id, rideId, sharedWithUserId);
  }
}
