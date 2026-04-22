import {
  CreateTripInputSchema,
  CreateTripReviewInputSchema,
  CreateTripWithWaypointsInputSchema,
  CreateWaypointInputSchema,
  JoinTripInputSchema,
  ReorderWaypointsInputSchema,
  TripShareTokenSchema,
  TripTemplateFiltersSchema,
  UpdateParticipantStatusInputSchema,
  UpdateTripInputSchema,
  UpdateWaypointInputSchema,
} from '@motovault/types/validators';
import { Injectable, Scope, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CreateTripInput } from './dto/create-trip.input';
import { CreateTripReviewInput } from './dto/create-trip-review.input';
import { CreateTripWithWaypointsInput } from './dto/create-trip-with-waypoints.input';
import { CreateWaypointInput } from './dto/create-waypoint.input';
import { JoinTripInput } from './dto/join-trip.input';
import { ReorderWaypointsInput } from './dto/reorder-waypoints.input';
import { TripTemplateFilterInput } from './dto/trip-template-filter.input';
import { UpdateParticipantStatusInput } from './dto/update-participant-status.input';
import { UpdateTripInput } from './dto/update-trip.input';
import { UpdateWaypointInput } from './dto/update-waypoint.input';
import { TripShareTokenError } from './errors/trip-share-token.errors';
import { SharedTrip } from './models/shared-trip.model';
import { Trip, TripConnection, TripReview, TripWaypoint } from './models/trip.model';
import { TripInvite } from './models/trip-invite.model';
import { TripLifecycleService } from './services/trip-lifecycle.service';
import { TripParticipantsService } from './services/trip-participants.service';
import { TripReviewsService } from './services/trip-reviews.service';
import { TripSavesService } from './services/trip-saves.service';
import { TripSharingService } from './services/trip-sharing.service';
import { TripTemplatesService } from './services/trip-templates.service';
import { TripWaypointsService } from './services/trip-waypoints.service';
import { TripReviewsLoader } from './loaders/trip-reviews.loader';
import { TripSavedLoader } from './loaders/trip-saved.loader';

@Resolver(() => Trip)
@UseGuards(GqlAuthGuard)
@Injectable({ scope: Scope.REQUEST })
export class TripsResolver {
  constructor(
    private readonly tripLifecycle: TripLifecycleService,
    private readonly tripWaypoints: TripWaypointsService,
    private readonly tripParticipants: TripParticipantsService,
    private readonly tripSharing: TripSharingService,
    private readonly tripTemplatesSvc: TripTemplatesService,
    private readonly tripReviewsSvc: TripReviewsService,
    private readonly tripSavesSvc: TripSavesService,
    private readonly tripReviewsLoader: TripReviewsLoader,
    private readonly tripSavedLoader: TripSavedLoader,
  ) {}

  // ==========================================
  // ResolveFields (DataLoader-backed, templates only)
  // ==========================================

  @ResolveField('reviews', () => [TripReview], { nullable: true })
  async resolveReviews(@Parent() trip: Trip): Promise<TripReview[] | null> {
    if (!trip.isTemplate) return null;
    return this.tripReviewsLoader.load(trip.id);
  }

  @ResolveField('isSaved', () => Boolean, { nullable: true })
  async resolveIsSaved(
    @Parent() trip: Trip,
    @CurrentUser() user?: AuthUser,
  ): Promise<boolean | null> {
    if (!trip.isTemplate || !user) return null;
    return this.tripSavedLoader.forUser(user.id).load(trip.id);
  }

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
    return this.tripLifecycle.getTrips(first ?? 20, after);
  }

  @Query(() => TripConnection)
  async myTrips(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripConnection> {
    return this.tripLifecycle.myTrips(user.id, first ?? 20, after);
  }

  @Query(() => Trip)
  @Public()
  async tripDetail(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<Trip> {
    return this.tripLifecycle.tripDetail(tripId);
  }

  @Query(() => SharedTrip, { nullable: true })
  @Public()
  @Throttle({ default: THROTTLE_PRESETS.SHARE_LINK })
  async tripByShareToken(@Args('shareToken') shareToken: string): Promise<SharedTrip | null> {
    const parsed = TripShareTokenSchema.safeParse(shareToken);
    if (!parsed.success) throw new TripShareTokenError('INVALID_FORMAT');
    return this.tripSharing.resolveTripByShareToken(parsed.data);
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
    return this.tripLifecycle.createTrip(user.id, input);
  }

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async createTripWithWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripWithWaypointsInputSchema))
    input: CreateTripWithWaypointsInput,
  ): Promise<Trip> {
    return this.tripLifecycle.createTripWithWaypoints(user.id, input);
  }

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async updateTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateTripInputSchema))
    input: UpdateTripInput,
  ): Promise<Trip> {
    return this.tripLifecycle.updateTrip(user.id, input.tripId, input);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async deleteTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripLifecycle.deleteTrip(user.id, tripId);
  }

  @Mutation(() => String)
  @Throttle({ default: THROTTLE_PRESETS.SHARE_LINK })
  async rotateTripShareToken(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<string> {
    return this.tripSharing.rotateTripShareToken(user.id, tripId);
  }

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async publishTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<Trip> {
    return this.tripLifecycle.publishTrip(user.id, tripId);
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
    return this.tripWaypoints.addWaypoint(user.id, input);
  }

  @Mutation(() => TripWaypoint)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async updateWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateWaypointInputSchema))
    input: UpdateWaypointInput,
  ): Promise<TripWaypoint> {
    return this.tripWaypoints.updateWaypoint(user.id, input.waypointId, input);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async removeWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('waypointId', { type: () => ID }, ParseUUIDPipe) waypointId: string,
  ): Promise<boolean> {
    return this.tripWaypoints.removeWaypoint(user.id, waypointId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async reorderWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(ReorderWaypointsInputSchema))
    input: ReorderWaypointsInput,
  ): Promise<boolean> {
    return this.tripWaypoints.reorderWaypoints(user.id, input.tripId, input.waypointIds);
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
    return this.tripParticipants.joinTrip(user.id, input.tripId, input.status, input.bikeId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async updateParticipantStatus(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateParticipantStatusInputSchema))
    input: UpdateParticipantStatusInput,
  ): Promise<boolean> {
    return this.tripParticipants.updateParticipantStatus(user.id, input.tripId, input.status);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async leaveTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripParticipants.leaveTrip(user.id, tripId);
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
    return this.tripSharing.inviteToTrip(user.id, tripId, invitedUserId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async respondToTripInvite(
    @CurrentUser() user: AuthUser,
    @Args('inviteId', { type: () => ID }, ParseUUIDPipe) inviteId: string,
    @Args('accept') accept: boolean,
  ): Promise<boolean> {
    return this.tripSharing.respondToTripInvite(user.id, inviteId, accept);
  }

  @Query(() => [TripInvite])
  async tripInvites(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<TripInvite[]> {
    return this.tripSharing.listTripInvites(user.id, tripId);
  }

  // ==========================================
  // Template Queries (Discover feed)
  // ==========================================

  @Query(() => TripConnection)
  @Public()
  async tripTemplates(
    @Args(
      'filter',
      { type: () => TripTemplateFilterInput, nullable: true },
      new ZodValidationPipe(TripTemplateFiltersSchema),
    )
    filter?: TripTemplateFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripConnection> {
    return this.tripTemplatesSvc.listTemplates(filter, first ?? 20, after);
  }

  @Query(() => Trip, { nullable: true })
  @Public()
  async tripBySlug(
    @Args('country') country: string,
    @Args('region') region: string,
    @Args('slug') slug: string,
  ): Promise<Trip> {
    return this.tripTemplatesSvc.getTemplateBySlug(country, region, slug);
  }

  // ==========================================
  // Template Mutations
  // ==========================================

  @Mutation(() => Trip)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async publishAsTemplate(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<Trip> {
    return this.tripTemplatesSvc.publishAsTemplate(user.id, tripId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async unpublishTemplate(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripTemplatesSvc.unpublishTemplate(user.id, tripId);
  }

  @Mutation(() => ID, { description: 'Returns the new trip ID' })
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async cloneTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<string> {
    return this.tripTemplatesSvc.cloneTemplate(user.id, tripId);
  }

  // ==========================================
  // Review Operations
  // ==========================================

  @Query(() => [TripReview])
  @Public()
  async tripReviews(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripReview[]> {
    const connection = await this.tripReviewsSvc.getReviewsForTrip(tripId, first ?? 20, after);
    return connection.edges.map((e) => ({
      ...e.node,
      text: e.node.text ?? undefined,
      bikeId: e.node.bikeId ?? undefined,
      userId: e.node.userId ?? undefined,
    }));
  }

  @Mutation(() => TripReview)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async createTripReview(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripReviewInputSchema))
    input: CreateTripReviewInput,
  ): Promise<TripReview> {
    const review = await this.tripReviewsSvc.createReview(user.id, input);
    return {
      ...review,
      text: review.text ?? undefined,
      bikeId: review.bikeId ?? undefined,
      userId: review.userId ?? undefined,
    };
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async deleteTripReview(
    @CurrentUser() user: AuthUser,
    @Args('reviewId', { type: () => ID }, ParseUUIDPipe) reviewId: string,
  ): Promise<boolean> {
    return this.tripReviewsSvc.deleteReview(user.id, reviewId);
  }

  // ==========================================
  // Save/Bookmark Operations
  // ==========================================

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async saveTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripSavesSvc.saveTrip(user.id, tripId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.GROUP_RIDE })
  async unsaveTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripSavesSvc.unsaveTrip(user.id, tripId);
  }

  @Query(() => Boolean)
  async isTripSaved(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripSavesSvc.isTripSaved(user.id, tripId);
  }

  @Query(() => TripConnection)
  async savedTrips(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripConnection> {
    return this.tripSavesSvc.savedTrips(user.id, first ?? 20, after);
  }
}
