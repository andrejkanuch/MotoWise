import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { ShareRideToDiscoverInputSchema } from '@motovault/types/validators';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { DiscoverRoutesFilterInput } from './dto/discover-routes-filter.input';
import { ShareRideToDiscoverInput } from './dto/share-ride-to-discover.input';
import { Route, RouteConnection } from './models/route.model';
import { RoutesService } from './routes.service';

@Resolver(() => Route)
@UseGuards(GqlAuthGuard)
export class RoutesResolver {
  constructor(private readonly routesService: RoutesService) {}

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
}
