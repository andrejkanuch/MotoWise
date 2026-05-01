import {
  CreateDiscoverTripReviewInputSchema,
  DiscoverTripsFilterSchema,
  ModerateDiscoverTripInputSchema,
  PublishTripToDiscoverInputSchema,
} from '@motovault/types/validators';
import { ForbiddenException, Logger, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DiscoverTripsService } from './discover-trips.service';
import { CreateDiscoverTripReviewInput } from './dto/create-discover-trip-review.input';
import { DiscoverTripsFilterInput } from './dto/discover-trips-filter.input';
import { ModerateDiscoverTripInput } from './dto/moderate-discover-trip.input';
import { PublishTripToDiscoverInput } from './dto/publish-trip-to-discover.input';
import {
  DiscoverTrip,
  DiscoverTripConnection,
  DiscoverTripReview,
} from './models/discover-trip.model';

/**
 * @deprecated This entire resolver is deprecated. New clients should use
 * tripTemplates / tripReviews / savedTrips queries from TripsResolver instead.
 * Kept for backward compatibility with old mobile app versions.
 */
@Resolver(() => DiscoverTrip)
@UseGuards(GqlAuthGuard)
export class DiscoverTripsResolver {
  private readonly logger = new Logger(DiscoverTripsResolver.name);

  constructor(private readonly discoverTripsService: DiscoverTripsService) {}

  // ==========================================
  // Queries (Public — no auth required for browse/detail)
  // ==========================================

  /** @deprecated Use tripTemplates query instead */
  @Query(() => DiscoverTripConnection)
  @Public()
  async discoverTrips(
    @Args('filter', { type: () => DiscoverTripsFilterInput, nullable: true })
    filter?: DiscoverTripsFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<DiscoverTripConnection> {
    this.logger.warn('DEPRECATED: discoverTrips called — use tripTemplates instead');
    const validated = filter ? DiscoverTripsFilterSchema.parse(filter) : undefined;
    return this.discoverTripsService.list(validated, first ?? 20, after);
  }

  /** @deprecated Use tripTemplateBySlug query instead */
  @Query(() => DiscoverTrip)
  @Public()
  async discoverTripBySlug(
    @Args('country') country: string,
    @Args('region') region: string,
    @Args('slug') slug: string,
  ): Promise<DiscoverTrip> {
    this.logger.warn('DEPRECATED: discoverTripBySlug called — use tripTemplateBySlug instead');
    const trip = await this.discoverTripsService.getBySlug(country, region, slug);
    this.discoverTripsService.incrementViewCount(trip.id);
    return trip;
  }

  /** @deprecated Use tripTemplateById query instead */
  @Query(() => DiscoverTrip)
  @Public()
  async discoverTripById(@Args('id', { type: () => ID }) id: string): Promise<DiscoverTrip> {
    this.logger.warn('DEPRECATED: discoverTripById called — use tripTemplateById instead');
    const trip = await this.discoverTripsService.getById(id);
    this.discoverTripsService.incrementViewCount(trip.id);
    return trip;
  }

  // ==========================================
  // Mutations (Auth required)
  // ==========================================

  /** @deprecated Use publishTripTemplate mutation instead */
  @Mutation(() => DiscoverTrip)
  async publishTripToDiscover(
    @Args('input', new ZodValidationPipe(PublishTripToDiscoverInputSchema))
    input: PublishTripToDiscoverInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DiscoverTrip> {
    this.logger.warn('DEPRECATED: publishTripToDiscover called — use publishTripTemplate instead');
    return this.discoverTripsService.publishTripToDiscover(input, user.id);
  }

  /** @deprecated Use unpublishTripTemplate mutation instead */
  @Mutation(() => Boolean)
  async unpublishFromDiscover(
    @Args('discoverTripId', { type: () => ID }) discoverTripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    this.logger.warn(
      'DEPRECATED: unpublishFromDiscover called — use unpublishTripTemplate instead',
    );
    return this.discoverTripsService.unpublishFromDiscover(discoverTripId, user.id);
  }

  /** @deprecated Use cloneTripTemplate mutation instead */
  @Mutation(() => ID, {
    description: "Clones a discover trip into the user's planner. Returns the new trip ID.",
  })
  async cloneDiscoverTrip(
    @Args('discoverTripId', { type: () => ID }) discoverTripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<string> {
    this.logger.warn('DEPRECATED: cloneDiscoverTrip called — use cloneTripTemplate instead');
    return this.discoverTripsService.cloneDiscoverTrip(discoverTripId, user.id);
  }

  /** @deprecated Use createTripReview mutation instead */
  @Mutation(() => DiscoverTripReview)
  async createDiscoverTripReview(
    @Args('input', new ZodValidationPipe(CreateDiscoverTripReviewInputSchema))
    input: CreateDiscoverTripReviewInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DiscoverTripReview> {
    this.logger.warn('DEPRECATED: createDiscoverTripReview called — use createTripReview instead');
    return this.discoverTripsService.createReview(input, user.id);
  }

  // ==========================================
  // Admin Mutations
  // ==========================================

  /** @deprecated Use moderateTripTemplate mutation instead */
  @Mutation(() => DiscoverTrip, { description: 'Admin only: moderate a discover trip.' })
  async moderateDiscoverTrip(
    @Args('input', new ZodValidationPipe(ModerateDiscoverTripInputSchema))
    input: ModerateDiscoverTripInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DiscoverTrip> {
    this.logger.warn('DEPRECATED: moderateDiscoverTrip called — use moderateTripTemplate instead');
    if (user.role !== 'admin') throw new ForbiddenException('Admin access required');
    return this.discoverTripsService.moderateTrip({
      discoverTripId: input.discoverTripId,
      status: input.status as 'published' | 'hidden' | 'flagged',
    });
  }
}
