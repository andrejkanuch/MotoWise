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
import { BadRequestException, Injectable, Scope, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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
import { GPXExportResult as GPXExportResultUnion } from '../routes/dto/gpx-export.dto';
import { TripReviewsLoader } from './loaders/trip-reviews.loader';
import { TripSavedLoader } from './loaders/trip-saved.loader';
import { SharedTrip } from './models/shared-trip.model';
import { Trip, TripConnection, TripReview, TripWaypoint } from './models/trip.model';
import { TripInvite } from './models/trip-invite.model';
import { TripLifecycleService } from './services/trip-lifecycle.service';
import { TripParticipantsService } from './services/trip-participants.service';
import { TripReviewsService } from './services/trip-reviews.service';
import { TripSavesService } from './services/trip-saves.service';
import { TripSharingService } from './services/trip-sharing.service';
import { TripTemplatesService } from './services/trip-templates.service';
import { TripGpxExportService } from './services/trip-gpx-export.service';
import { TripWaypointsService } from './services/trip-waypoints.service';

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
    private readonly tripGpxExport: TripGpxExportService,
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

  /** Upcoming public trips from real riders (non-templates) for Discover preview strip. */
  @Query(() => TripConnection)
  @Public()
  async discoverRiderTrips(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 5 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripConnection> {
    return this.tripLifecycle.getDiscoverRiderTrips(first ?? 5, after);
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
  async tripByShareToken(@Args('shareToken') shareToken: string): Promise<SharedTrip | null> {
    const parsed = TripShareTokenSchema.safeParse(shareToken);
    if (!parsed.success) throw new TripShareTokenError('INVALID_FORMAT');
    return this.tripSharing.resolveTripByShareToken(parsed.data);
  }

  // ==========================================
  // Trip Mutations
  // ==========================================

  @Mutation(() => Trip)
  async createTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripInputSchema))
    input: CreateTripInput,
  ): Promise<Trip> {
    return this.tripLifecycle.createTrip(user.id, input);
  }

  @Mutation(() => Trip)
  async createTripWithWaypoints(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripWithWaypointsInputSchema))
    input: CreateTripWithWaypointsInput,
  ): Promise<Trip> {
    return this.tripLifecycle.createTripWithWaypoints(user.id, input);
  }

  @Mutation(() => Trip)
  async updateTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateTripInputSchema))
    input: UpdateTripInput,
  ): Promise<Trip> {
    return this.tripLifecycle.updateTrip(user.id, input.tripId, input);
  }

  @Mutation(() => Boolean)
  async deleteTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripLifecycle.deleteTrip(user.id, tripId);
  }

  @Mutation(() => String)
  async rotateTripShareToken(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<string> {
    return this.tripSharing.rotateTripShareToken(user.id, tripId);
  }

  @Mutation(() => Trip)
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
  async addWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateWaypointInputSchema))
    input: CreateWaypointInput,
  ): Promise<TripWaypoint> {
    return this.tripWaypoints.addWaypoint(user.id, input);
  }

  @Mutation(() => TripWaypoint)
  async updateWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateWaypointInputSchema))
    input: UpdateWaypointInput,
  ): Promise<TripWaypoint> {
    return this.tripWaypoints.updateWaypoint(user.id, input.waypointId, input);
  }

  @Mutation(() => Boolean)
  async removeWaypoint(
    @CurrentUser() user: AuthUser,
    @Args('waypointId', { type: () => ID }, ParseUUIDPipe) waypointId: string,
  ): Promise<boolean> {
    return this.tripWaypoints.removeWaypoint(user.id, waypointId);
  }

  @Mutation(() => Boolean)
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
  async joinTrip(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(JoinTripInputSchema))
    input: JoinTripInput,
  ): Promise<boolean> {
    return this.tripParticipants.joinTrip(user.id, input.tripId, input.status, input.bikeId);
  }

  @Mutation(() => Boolean)
  async updateParticipantStatus(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateParticipantStatusInputSchema))
    input: UpdateParticipantStatusInput,
  ): Promise<boolean> {
    return this.tripParticipants.updateParticipantStatus(user.id, input.tripId, input.status);
  }

  @Mutation(() => Boolean)
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
  async inviteToTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
    @Args('invitedUserId', { type: () => ID }, ParseUUIDPipe) invitedUserId: string,
  ): Promise<boolean> {
    return this.tripSharing.inviteToTrip(user.id, tripId, invitedUserId);
  }

  @Mutation(() => Boolean)
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
    const trip = await this.tripTemplatesSvc.getTemplateBySlug(country, region, slug);
    this.tripTemplatesSvc.incrementViewCount(trip.id);
    return trip;
  }

  /** Resolves a published route id to the Discover template trip id, if one exists. */
  @Query(() => ID, { nullable: true })
  @Public()
  async templateTripIdForRoute(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<string | null> {
    return this.tripTemplatesSvc.getTemplateIdForRouteId(routeId);
  }

  // ==========================================
  // Template Mutations
  // ==========================================

  @Mutation(() => Trip)
  async publishAsTemplate(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<Trip> {
    return this.tripTemplatesSvc.publishAsTemplate(user.id, tripId);
  }

  @Mutation(() => Boolean)
  async unpublishTemplate(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripTemplatesSvc.unpublishTemplate(user.id, tripId);
  }

  @Mutation(() => ID, { description: 'Returns the new trip ID' })
  async cloneTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<string> {
    return this.tripTemplatesSvc.cloneTemplate(user.id, tripId);
  }

  // ==========================================
  // Review Operations
  // ==========================================

  @Query(() => [TripReview], {
    description: 'Get reviews for a trip by ID or by slug (country+region+slug lookup)',
  })
  @Public()
  async tripReviews(
    @Args('tripId', { type: () => ID, nullable: true })
    tripId?: string,
    @Args('slug', { nullable: true }) slug?: string,
    @Args('country', { nullable: true }) country?: string,
    @Args('region', { nullable: true }) region?: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<TripReview[]> {
    let resolvedTripId = tripId;

    // Slug-based lookup: resolve slug → tripId first
    if (!resolvedTripId && slug && country && region) {
      const trip = await this.tripTemplatesSvc.getTemplateBySlug(country, region, slug);
      resolvedTripId = trip.id;
    }

    if (!resolvedTripId) {
      throw new BadRequestException('Either tripId or (slug + country + region) is required');
    }

    const connection = await this.tripReviewsSvc.getReviewsForTrip(
      resolvedTripId,
      first ?? 20,
      after,
    );
    return connection.edges.map((e) => ({
      ...e.node,
      text: e.node.text ?? undefined,
      bikeId: e.node.bikeId ?? undefined,
      userId: e.node.userId ?? undefined,
    }));
  }

  @Mutation(() => TripReview)
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
  async deleteTripReview(
    @CurrentUser() user: AuthUser,
    @Args('reviewId', { type: () => ID }, ParseUUIDPipe) reviewId: string,
  ): Promise<boolean> {
    return this.tripReviewsSvc.deleteReview(user.id, reviewId);
  }

  // ==========================================
  // GPX Export (trip-based, replaces routes GPX export)
  // ==========================================

  @Mutation(() => GPXExportResultUnion, {
    description: 'Export a trip template as GPX. Metered for free users (1/month), unlimited for Pro.',
  })
  async exportTripGPX(
    @CurrentUser() user: AuthUser,
    @Args('slug') slug: string,
    @Args('country') country: string,
    @Args('region') region: string,
  ): Promise<typeof GPXExportResultUnion> {
    return this.tripGpxExport.exportTripGPX(user, slug, country, region);
  }

  // ==========================================
  // Similar Trips (Explore funnel)
  // ==========================================

  @Query(() => [Trip], {
    description: 'Find similar published trip templates by country + difficulty + duration',
  })
  @Public()
  async similarTrips(
    @Args('slug') slug: string,
    @Args('country') country: string,
    @Args('region') region: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 6 })
    limit?: number,
  ): Promise<Trip[]> {
    return this.tripTemplatesSvc.findSimilarTrips(slug, country, region, limit ?? 6);
  }

  // ==========================================
  // Save/Bookmark Operations
  // ==========================================

  @Mutation(() => Boolean)
  async saveTrip(
    @CurrentUser() user: AuthUser,
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<boolean> {
    return this.tripSavesSvc.saveTrip(user.id, tripId);
  }

  @Mutation(() => Boolean)
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
