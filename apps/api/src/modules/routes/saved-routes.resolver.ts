import { Injectable, Logger, Scope, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { IsRouteSavedLoader } from './is-route-saved.loader';
import { Route, RouteConnection } from './models/route.model';
import { SavedRoutesService } from './saved-routes.service';

/**
 * @deprecated This entire resolver is deprecated. New clients should use
 * savedTrips / saveTripTemplate / unsaveTripTemplate queries/mutations
 * from TripsResolver instead. Kept for backward compatibility with old mobile app versions.
 */
@Resolver(() => Route)
@UseGuards(GqlAuthGuard)
@Injectable({ scope: Scope.REQUEST })
export class SavedRoutesResolver {
  private readonly logger = new Logger(SavedRoutesResolver.name);

  constructor(
    private readonly savedRoutesService: SavedRoutesService,
    private readonly isRouteSavedLoader: IsRouteSavedLoader,
  ) {}

  // ==========================================
  // Queries
  // ==========================================

  /** @deprecated Use savedTrips query instead */
  @Query(() => RouteConnection, {
    description: "Paginated list of the authenticated user's saved routes",
  })
  async savedRoutes(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteConnection> {
    this.logger.warn('DEPRECATED: savedRoutes called — use savedTrips instead');
    return this.savedRoutesService.getUserSavedRoutes(user.id, first ?? 20, after);
  }

  /** @deprecated Use publicSavedTrips query instead */
  @Query(() => RouteConnection, {
    description: 'Public saved routes for a user by handle (public_username)',
  })
  @Public()
  async publicSavedRoutes(
    @Args('handle') handle: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteConnection> {
    this.logger.warn('DEPRECATED: publicSavedRoutes called — use publicSavedTrips instead');
    return this.savedRoutesService.getPublicSavedRoutes(handle, first ?? 20, after);
  }

  @Query(() => Boolean, {
    description: 'Check if the authenticated user has saved a specific route',
  })
  async isRouteSaved(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<boolean> {
    return this.isRouteSavedLoader.forUser(user.id).load(routeId);
  }

  // ==========================================
  // Mutations
  // ==========================================

  @Mutation(() => Boolean, { description: 'Save a route to your collection' })
  async saveRouteToCollection(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<boolean> {
    return this.savedRoutesService.saveRoute(user.id, routeId);
  }

  @Mutation(() => Boolean, { description: 'Remove a saved route from your collection' })
  async unsaveRouteFromCollection(
    @CurrentUser() user: AuthUser,
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<boolean> {
    return this.savedRoutesService.unsaveRoute(user.id, routeId);
  }
}
