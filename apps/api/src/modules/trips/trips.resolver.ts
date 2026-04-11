import {
  CreateTripInputSchema,
  CreateTripWithWaypointsInputSchema,
  CreateWaypointInputSchema,
  JoinTripInputSchema,
  ReorderWaypointsInputSchema,
  TripShareTokenSchema,
  UpdateParticipantStatusInputSchema,
  UpdateTripInputSchema,
  UpdateWaypointInputSchema,
} from '@motovault/types/validators';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CreateTripInput } from './dto/create-trip.input';
import { CreateTripWithWaypointsInput } from './dto/create-trip-with-waypoints.input';
import { CreateWaypointInput } from './dto/create-waypoint.input';
import { JoinTripInput } from './dto/join-trip.input';
import { ReorderWaypointsInput } from './dto/reorder-waypoints.input';
import { UpdateParticipantStatusInput } from './dto/update-participant-status.input';
import { UpdateTripInput } from './dto/update-trip.input';
import { UpdateWaypointInput } from './dto/update-waypoint.input';
import { TripShareTokenError } from './errors/trip-share-token.errors';
import { SharedTrip } from './models/shared-trip.model';
import { Trip, TripConnection, TripWaypoint } from './models/trip.model';
import { TripInvite } from './models/trip-invite.model';
import { TripsService } from './trips.service';

@Resolver(() => Trip)
@UseGuards(GqlAuthGuard)
export class TripsResolver {
  constructor(private readonly tripsService: TripsService) {}

  // ==========================================
  // Queries
  // ==========================================

  @Query(() => TripConnection)
  @Public()
  async getTrips(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripConnection> {
    return this.tripsService.getTrips(first ?? 20, after);
  }

  @Query(() => TripConnection)
  async myTrips(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripConnection> {
    return this.tripsService.myTrips(user.id, first ?? 20, after);
  }

  @Query(() => Trip)
  @Public()
  async tripDetail(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<Trip> {
    return this.tripsService.tripDetail(tripId);
  }

  @Query(() => SharedTrip, { nullable: true })
  @Public()
  @Throttle({ default: THROTTLE_PRESETS.SHARE_LINK })
  async tripByShareToken(@Args('shareToken') shareToken: string): Promise<SharedTrip | null> {
    const parsed = TripShareTokenSchema.safeParse(shareToken);
    if (!parsed.success) throw new TripShareTokenError('INVALID_FORMAT');
    return this.tripsService.resolveTripByShareToken(parsed.data);
  }

  // ==========================================
  // Trip Mutations
  // ==========================================

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async createTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripInputSchema))
    input: CreateTripInput,
  ): Promise<Trip> {
    return this.tripsService.createTrip(user.id, input);
  }

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async createTripWithWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripWithWaypointsInputSchema))
    input: CreateTripWithWaypointsInput,
  ): Promise<Trip> {
    return this.tripsService.createTripWithWaypoints(user.id, input);
  }

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async updateTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateTripInputSchema))
    input: UpdateTripInput,
  ): Promise<Trip> {
    return this.tripsService.updateTrip(user.id, input.tripId, input);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async deleteTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripsService.deleteTrip(user.id, tripId);
  }

  @Mutation(() => String)
  @Throttle({ default: THROTTLE_PRESETS.SHARE_LINK })
  async rotateTripShareToken(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<string> {
    return this.tripsService.rotateTripShareToken(user.id, tripId);
  }

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async publishTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<Trip> {
    return this.tripsService.publishTrip(user.id, tripId);
  }

  // ==========================================
  // Waypoint Mutations
  // ==========================================

  @Mutation(() => TripWaypoint)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async addWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateWaypointInputSchema))
    input: CreateWaypointInput,
  ): Promise<TripWaypoint> {
    return this.tripsService.addWaypoint(user.id, input);
  }

  @Mutation(() => TripWaypoint)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async updateWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateWaypointInputSchema))
    input: UpdateWaypointInput,
  ): Promise<TripWaypoint> {
    return this.tripsService.updateWaypoint(user.id, input.waypointId, input);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async removeWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('waypointId', { type: () => ID }, ParseUUIDPipe) waypointId: string,
  ): Promise<boolean> {
    return this.tripsService.removeWaypoint(user.id, waypointId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async reorderWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(ReorderWaypointsInputSchema))
    input: ReorderWaypointsInput,
  ): Promise<boolean> {
    return this.tripsService.reorderWaypoints(user.id, input.tripId, input.waypointIds);
  }

  // ==========================================
  // Participant Mutations
  // ==========================================

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async joinTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(JoinTripInputSchema))
    input: JoinTripInput,
  ): Promise<boolean> {
    return this.tripsService.joinTrip(user.id, input.tripId, input.status, input.bikeId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async updateParticipantStatus(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateParticipantStatusInputSchema))
    input: UpdateParticipantStatusInput,
  ): Promise<boolean> {
    return this.tripsService.updateParticipantStatus(user.id, input.tripId, input.status);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async leaveTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripsService.leaveTrip(user.id, tripId);
  }

  // ==========================================
  // Trip invites (privacy feature)
  // ==========================================

  @Mutation(() => Boolean)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async inviteToTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
    @Args('invitedUserId', { type: () => ID }, ParseUUIDPipe) invitedUserId: string,
  ): Promise<boolean> {
    return this.tripsService.inviteToTrip(user.id, tripId, invitedUserId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async respondToTripInvite(
    @CurrentUser() user: AuthUser,
    @Args('inviteId', { type: () => ID }, ParseUUIDPipe) inviteId: string,
    @Args('accept') accept: boolean,
  ): Promise<boolean> {
    return this.tripsService.respondToTripInvite(user.id, inviteId, accept);
  }

  @Query(() => [TripInvite])
  async tripInvites(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<TripInvite[]> {
    return this.tripsService.listTripInvites(user.id, tripId);
  }
}
