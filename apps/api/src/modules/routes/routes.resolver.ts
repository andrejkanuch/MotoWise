import {
  CreateRouteReviewInputSchema,
  ShareRideToDiscoverInputSchema,
} from '@motovault/types/validators';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ENTITLEMENTS, EntitlementsService } from '../entitlements/entitlements.service';
import { CreateRouteReviewInput } from './dto/create-route-review.input';
import { GPXExportError, GPXExportResult, GPXExportSuccess } from './dto/gpx-export.dto';
import { ShareRideToDiscoverInput } from './dto/share-ride-to-discover.input';
import { Route } from './models/route.model';
import { RouteReview, RouteReviewConnection } from './models/route-review.model';
import { RoutesService } from './routes.service';

/** Max reviews visible to anonymous users */
const ANONYMOUS_REVIEW_LIMIT = 3;

@Resolver(() => Route)
@UseGuards(GqlAuthGuard)
export class RoutesResolver {
  constructor(
    private readonly routesService: RoutesService,
    private readonly entitlementService: EntitlementsService,
  ) {}

  // ==========================================
  // Route Discovery — DEPRECATED queries removed
  // ==========================================
  // discoverRoutes → use TripsResolver.tripTemplates
  // routeBySlug → use TripsResolver.tripBySlug
  // routeDetail → use TripsResolver.tripDetail
  // sitemapPublishedRoutes → migrating to TripsResolver (Track 9A.6)
  // routePathById → migrating to TripsResolver (Track 9A.9)
  // twistScore/twistPercentile → removed (ResolveFields on deprecated model)

  @Mutation(() => Route)
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
    @CurrentUser() user: AuthUser | null,
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
  async createRouteReview(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateRouteReviewInputSchema))
    input: CreateRouteReviewInput,
  ): Promise<RouteReview> {
    return this.routesService.createRouteReview(user.id, input);
  }

  // ==========================================
  // GPX Export
  // ==========================================

  @Mutation(() => GPXExportResult)
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
