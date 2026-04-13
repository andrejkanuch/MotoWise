import {
  CreateRouteReviewInputSchema,
  ShareRideToDiscoverInputSchema,
} from '@motovault/types/validators';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CreateRouteReviewInput } from './dto/create-route-review.input';
import { DiscoverRoutesFilterInput } from './dto/discover-routes-filter.input';
import { ShareRideToDiscoverInput } from './dto/share-ride-to-discover.input';
import { Route, RouteConnection } from './models/route.model';
import { RouteReview, RouteReviewConnection } from './models/route-review.model';
import { RoutesService } from './routes.service';

@Resolver(() => Route)
@UseGuards(GqlAuthGuard)
export class RoutesResolver {
  constructor(private readonly routesService: RoutesService) {}

  // ==========================================
  // Route Discovery
  // ==========================================

  @Query(() => RouteConnection)
  @Public()
  async discoverRoutes(
    @Args('filter', { type: () => DiscoverRoutesFilterInput, nullable: true })
    filter?: DiscoverRoutesFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteConnection> {
    return this.routesService.discoverRoutes(filter, first ?? 20, after);
  }

  @Query(() => Route)
  @Public()
  async routeDetail(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<Route> {
    return this.routesService.routeDetail(routeId);
  }

  @Query(() => Route, { nullable: true })
  @Public()
  async routeBySlug(
    @Args('country') country: string,
    @Args('region') region: string,
    @Args('slug') slug: string,
  ): Promise<Route | null> {
    return this.routesService.routeBySlug(country, region, slug);
  }

  @Mutation(() => Route)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async shareRideToDiscover(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(ShareRideToDiscoverInputSchema))
    input: ShareRideToDiscoverInput,
  ): Promise<Route> {
    return this.routesService.shareRideToDiscover(user.id, input);
  }

  @Mutation(() => Boolean)
  async unshareRoute(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<boolean> {
    return this.routesService.unshareRoute(routeId, user.id);
  }

  // ==========================================
  // Route Reviews
  // ==========================================

  @Query(() => RouteReviewConnection)
  @Public()
  async getRouteReviews(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 10 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteReviewConnection> {
    return this.routesService.getRouteReviews(routeId, first ?? 10, after);
  }

  @Mutation(() => RouteReview)
  @Throttle({ default: THROTTLE_PRESETS.COMMENT })
  async createRouteReview(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateRouteReviewInputSchema))
    input: CreateRouteReviewInput,
  ): Promise<RouteReview> {
    return this.routesService.createRouteReview(user.id, input);
  }

  // ==========================================
  // Route Saves (Bookmarks)
  // ==========================================

  @Mutation(() => Boolean)
  async saveRoute(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<boolean> {
    return this.routesService.saveRoute(user.id, routeId);
  }

  @Mutation(() => Boolean)
  async unsaveRoute(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<boolean> {
    return this.routesService.unsaveRoute(user.id, routeId);
  }

  // ==========================================
  // Premium Waitlist
  // ==========================================

  @Mutation(() => Boolean)
  async joinPremiumWaitlist(
    @CurrentUser() user: AuthUser,
    @Args('feature') feature: string,
  ): Promise<boolean> {
    if (feature !== 'offline_routes' && feature !== 'premium_general') {
      throw new BadRequestException('Invalid feature. Must be offline_routes or premium_general');
    }
    return this.routesService.joinPremiumWaitlist(user.id, feature);
  }
}
