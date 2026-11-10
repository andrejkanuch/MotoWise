import {
  EndRideInputSchema,
  RidePauseInputSchema,
  StartRideInputSchema,
  UpdateRideInputSchema,
  UploadWaypointsInputSchema,
} from '@motovault/types';
import { BadRequestException, Injectable, Scope } from '@nestjs/common';
import { Args, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EndRideInput } from './dto/end-ride.input';
import { RidePauseInput } from './dto/ride-pause.input';
import { StartRideInput } from './dto/start-ride.input';
import { UpdateRideInput } from './dto/update-ride.input';
import { UploadWaypointsInput } from './dto/upload-waypoints.input';
import { EndRideResponse } from './models/end-ride-response.model';
import { Ride } from './models/ride.model';
import { RideConnection } from './models/ride-connection.model';
import { RideDerivedStats } from './models/ride-derived-stats.model';
import { RideMilestoneStats } from './models/ride-milestone-stats.model';
import { Waypoint } from './models/waypoint.model';
import { RideDerivedLoader } from './ride-derived.loader';
import { type RideDerived, RidesService } from './rides.service';

/** `value` for the ride's owner; null for anyone else, signed in or not. */
function ownerOnly<T>(ride: Ride, user: AuthUser | undefined, value: T | undefined): T | null {
  return user?.id === ride.userId ? (value ?? null) : null;
}

@Resolver(() => Ride)
@Injectable({ scope: Scope.REQUEST })
export class RidesResolver {
  constructor(
    private readonly ridesService: RidesService,
    private readonly rideDerivedLoader: RideDerivedLoader,
  ) {}

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

  /** True when the ride is now paused; false when it is no longer open (ended,
   *  deleted, not this rider's) — never an error, so the phone's queue moves on. */
  @Mutation(() => Boolean)
  async pauseRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(RidePauseInputSchema)) input: RidePauseInput,
  ): Promise<boolean> {
    return this.ridesService.setRidePaused(user.id, input.rideId, true);
  }

  /** True when the ride is recording again; false when it is no longer open. */
  @Mutation(() => Boolean)
  async resumeRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(RidePauseInputSchema)) input: RidePauseInput,
  ): Promise<boolean> {
    return this.ridesService.setRidePaused(user.id, input.rideId, false);
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
      throw new BadRequestException(`Invalid visibility: ${visibility}`);
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

  // ==========================================
  // Owner-only fields: how the rider rode. They resolve only for the ride's owner
  // and are null on public or shared reads, so a public ride link never discloses
  // the rider's time zone, how the ride ended or their answers.
  // ==========================================

  @ResolveField('timeZone', () => String, { nullable: true })
  timeZone(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): string | null {
    return ownerOnly(ride, user, ride.timeZone);
  }

  @ResolveField('endSource', () => String, { nullable: true })
  endSource(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): string | null {
    return ownerOnly(ride, user, ride.endSource);
  }

  @ResolveField('purpose', () => String, { nullable: true })
  purpose(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): string | null {
    return ownerOnly(ride, user, ride.purpose);
  }

  @ResolveField('passenger', () => Boolean, { nullable: true })
  passenger(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): boolean | null {
    return ownerOnly(ride, user, ride.passenger);
  }

  // ==========================================
  // Derived fields from the ride's stats. Places, countries and stats are owner
  // only, like the fields above; newRoadsM also needs the owner's real Pro tier.
  // ==========================================

  /** The owner's derived fields of this ride, or null for anyone else or while pending. */
  private ownDerived(ride: Ride, user: AuthUser | undefined): Promise<RideDerived | null> | null {
    return user?.id === ride.userId ? this.rideDerivedLoader.loadDerived(ride.id, user.id) : null;
  }

  @ResolveField('startPlace', () => String, { nullable: true })
  async startPlace(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): Promise<string | null> {
    return (await this.ownDerived(ride, user))?.startPlace ?? null;
  }

  @ResolveField('endPlace', () => String, { nullable: true })
  async endPlace(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): Promise<string | null> {
    return (await this.ownDerived(ride, user))?.endPlace ?? null;
  }

  @ResolveField('countries', () => [String], { nullable: true })
  async countries(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): Promise<string[] | null> {
    return (await this.ownDerived(ride, user))?.countries ?? null;
  }

  @ResolveField('stats', () => RideDerivedStats, { nullable: true })
  async stats(
    @Parent() ride: Ride,
    @CurrentUser() user?: AuthUser,
  ): Promise<RideDerivedStats | null> {
    return (await this.ownDerived(ride, user))?.stats ?? null;
  }

  /**
   * Single-ride views only: each resolution runs one `ride_new_roads` RPC (a
   * spatial query over the rider's earlier rides) and nothing batches it, so
   * selecting it on a ride list would fan out one heavy query per row.
   */
  @ResolveField('newRoadsM', () => Int, { nullable: true })
  async newRoadsM(@Parent() ride: Ride, @CurrentUser() user?: AuthUser): Promise<number | null> {
    return user?.id === ride.userId ? this.ridesService.findNewRoadsM(user.id, ride.id) : null;
  }

  /**
   * Public, as it always was. The stored value when there is one; otherwise the
   * name of the country the ride started in, from its stats (batched).
   */
  @ResolveField('region', () => String, { nullable: true })
  async region(@Parent() ride: Ride): Promise<string | null> {
    return ride.region ?? this.rideDerivedLoader.loadStartCountry(ride.id);
  }

  @Query(() => RideMilestoneStats)
  async rideMilestoneStats(
    @CurrentUser() user: AuthUser,
    @Args('excludeRideId', { nullable: true }, ParseUUIDPipe) excludeRideId?: string,
  ): Promise<RideMilestoneStats> {
    return this.ridesService.getRideMilestoneStats(user.id, excludeRideId ?? null);
  }
}
