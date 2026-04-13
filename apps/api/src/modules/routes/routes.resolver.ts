import {
  CreateRouteReviewInputSchema,
  ShareRideToDiscoverInputSchema,
} from '@motovault/types/validators';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { ENTITLEMENTS, EntitlementService } from '../entitlements/entitlements.service';
import { CreateRouteReviewInput } from './dto/create-route-review.input';
import { DiscoverRoutesFilterInput } from './dto/discover-routes-filter.input';
import {
  GPXExportError,
  GPXExportResult,
  GPXExportSuccess,
} from './dto/gpx-export.dto';
import { ShareRideToDiscoverInput } from './dto/share-ride-to-discover.input';
import { Route, RouteConnection } from './models/route.model';
import { RouteReview, RouteReviewConnection } from './models/route-review.model';
import { RoutesService } from './routes.service';

/** Max reviews visible to anonymous users */
const ANONYMOUS_REVIEW_LIMIT = 3;

@Resolver(() => Route)
@UseGuards(GqlAuthGuard)
export class RoutesResolver {
  constructor(
    private readonly routesService: RoutesService,
    private readonly entitlementService: EntitlementService,
  ) {}

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

  @Query(() => Route, { nullable: true })
  @Public()
  async routeBySlug(
    @Args('country') country: string,
    @Args('region') region: string,
    @Args('slug') slug: string,
  ): Promise<Route | null> {
    return this.routesService.findBySlug(country, region, slug);
  }

  @Query(() => Route)
  @Public()
  async routeDetail(
    @CurrentUser() user: AuthUser | undefined,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<Route> {
    const route = await this.routesService.routeDetail(routeId);

    // Gate premium fields for anonymous users
    const canReadFull = this.entitlementService.can(user, ENTITLEMENTS.READ_FULL_ROUTE);
    if (!canReadFull) {
      return {
        ...route,
        polyline: undefined,
        editorialDescription: undefined,
      };
    }

    return route;
  }

  @ResolveField(() => Int, { nullable: true })
  async twistScore(@Parent() route: Route): Promise<number | null> {
    const result = await this.routesService.computeTwistScore(
      route.curvatureIndex,
      route.countryCode,
    );
    return result?.score ?? null;
  }

  @ResolveField(() => Int, { nullable: true })
  async twistPercentile(@Parent() route: Route): Promise<number | null> {
    const result = await this.routesService.computeTwistScore(
      route.curvatureIndex,
      route.countryCode,
    );
    return result?.percentile ?? null;
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
    @CurrentUser() user: AuthUser | undefined,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 10 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteReviewConnection> {
    const canReadAll = this.entitlementService.can(user, ENTITLEMENTS.READ_ALL_REVIEWS);

    // Anonymous users: cap at ANONYMOUS_REVIEW_LIMIT, ignore pagination
    const effectiveFirst = canReadAll ? (first ?? 10) : ANONYMOUS_REVIEW_LIMIT;
    const effectiveAfter = canReadAll ? after : undefined;

    const result = await this.routesService.getRouteReviews(
      routeId,
      effectiveFirst,
      effectiveAfter,
    );

    // For anonymous: signal there are more reviews behind auth
    if (!canReadAll) {
      return {
        ...result,
        hasNextPage: result.totalCount > ANONYMOUS_REVIEW_LIMIT,
      };
    }

    return result;
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

  @Query(() => RouteConnection)
  async savedRoutes(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteConnection> {
    const result = await this.routesService.getSavedRoutes(user.id, first ?? 20, after);

    const edges = result.saves
      .filter((s) => s.route != null)
      .map((s) => ({
        node: s.route!,
        cursor: Buffer.from(s.savedAt).toString('base64'),
      }));

    const lastEdge = edges[edges.length - 1];

    return {
      edges,
      pageInfo: {
        hasNextPage: result.hasNextPage,
        endCursor: lastEdge?.cursor,
      },
    };
  }

  // ==========================================
  // Public Saved Routes (by handle)
  // ==========================================

  @Query(() => RouteConnection)
  @Public()
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async publicSavedRoutes(
    @Args('handle') handle: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteConnection> {
    return this.routesService.publicSavedRoutes(handle, first ?? 20, after);
  }

  // ==========================================
  // GPX Export
  // ==========================================

  @Mutation(() => GPXExportResult)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async exportRouteGPX(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<GPXExportSuccess | GPXExportError> {
    return this.routesService.exportRouteGPXWithEntitlement(user.id, routeId);
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
