import {
  CreateDiscoverTripReviewInputSchema,
  DiscoverTripsFilterSchema,
  ModerateDiscoverTripInputSchema,
  PublishTripToDiscoverInputSchema,
} from '@motovault/types/validators';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CreateDiscoverTripReviewInput } from './dto/create-discover-trip-review.input';
import { DiscoverTripsFilterInput } from './dto/discover-trips-filter.input';
import { ModerateDiscoverTripInput } from './dto/moderate-discover-trip.input';
import { PublishTripToDiscoverInput } from './dto/publish-trip-to-discover.input';
import { DiscoverTripsService } from './discover-trips.service';
import {
  DiscoverTrip,
  DiscoverTripConnection,
  DiscoverTripReview,
} from './models/discover-trip.model';

@Resolver(() => DiscoverTrip)
@UseGuards(GqlAuthGuard)
export class DiscoverTripsResolver {
  constructor(private readonly discoverTripsService: DiscoverTripsService) {}

  // ==========================================
  // Queries (Public — no auth required for browse/detail)
  // ==========================================

  @Query(() => DiscoverTripConnection)
  @Public()
  async discoverTrips(
    @Args('filter', { type: () => DiscoverTripsFilterInput, nullable: true })
    filter?: DiscoverTripsFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<DiscoverTripConnection> {
    const validated = filter
      ? DiscoverTripsFilterSchema.parse(filter)
      : undefined;
    return this.discoverTripsService.list(validated, first ?? 20, after);
  }

  @Query(() => DiscoverTrip)
  @Public()
  async discoverTripBySlug(
    @Args('country') country: string,
    @Args('region') region: string,
    @Args('slug') slug: string,
  ): Promise<DiscoverTrip> {
    return this.discoverTripsService.getBySlug(country, region, slug);
  }

  @Query(() => DiscoverTrip)
  @Public()
  async discoverTripById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DiscoverTrip> {
    return this.discoverTripsService.getById(id);
  }

  // ==========================================
  // Mutations (Auth required)
  // ==========================================

  @Mutation(() => DiscoverTrip)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async publishTripToDiscover(
    @Args('input', new ZodValidationPipe(PublishTripToDiscoverInputSchema))
    input: PublishTripToDiscoverInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DiscoverTrip> {
    return this.discoverTripsService.publishTripToDiscover(input, user.id);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async unpublishFromDiscover(
    @Args('discoverTripId', { type: () => ID }) discoverTripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    return this.discoverTripsService.unpublishFromDiscover(discoverTripId, user.id);
  }

  @Mutation(() => ID, { description: 'Clones a discover trip into the user\'s planner. Returns the new trip ID.' })
  @Throttle({ default: THROTTLE_PRESETS.CLONE })
  async cloneDiscoverTrip(
    @Args('discoverTripId', { type: () => ID }) discoverTripId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<string> {
    return this.discoverTripsService.cloneDiscoverTrip(discoverTripId, user.id);
  }

  @Mutation(() => DiscoverTripReview)
  @Throttle({ default: THROTTLE_PRESETS.COMMENT })
  async createDiscoverTripReview(
    @Args('input', new ZodValidationPipe(CreateDiscoverTripReviewInputSchema))
    input: CreateDiscoverTripReviewInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DiscoverTripReview> {
    return this.discoverTripsService.createReview(input, user.id);
  }

  // ==========================================
  // Admin Mutations
  // ==========================================

  @Mutation(() => DiscoverTrip, { description: 'Admin only: moderate a discover trip.' })
  async moderateDiscoverTrip(
    @Args('input', new ZodValidationPipe(ModerateDiscoverTripInputSchema))
    input: ModerateDiscoverTripInput,
    @CurrentUser() user: AuthUser,
  ): Promise<DiscoverTrip> {
    if (user.role !== 'admin') throw new ForbiddenException('Admin access required');
    return this.discoverTripsService.moderateTrip({
      discoverTripId: input.discoverTripId,
      status: input.status as 'published' | 'hidden' | 'flagged',
    });
  }
}
