import { UseGuards } from '@nestjs/common';
import { Args, Float, ID, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { FuelRangeResult, FuelStop } from './models/fuel-stop.model';
import { FuelStopsService } from './fuel-stops.service';

@Resolver()
@UseGuards(GqlAuthGuard)
export class FuelStopsResolver {
  constructor(private readonly fuelStopsService: FuelStopsService) {}

  /**
   * Get fuel stops near a route with range summary for a specific bike.
   * Public so unauthenticated users can see fuel stops on shared routes;
   * bike lookup uses SUPABASE_USER (RLS-scoped) so only the bike owner
   * gets personalised range data.
   */
  @Query(() => FuelRangeResult)
  @Public()
  async fuelStopsNearRoute(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
    @Args('bikeId', { type: () => ID, nullable: true }) bikeId?: string,
    @Args('radiusKm', { type: () => Float, nullable: true, defaultValue: 5 })
    radiusKm?: number,
  ): Promise<FuelRangeResult> {
    // 1. Get fuel stops near the route
    const fuelStops = await this.fuelStopsService.getFuelStopsNearRoute(
      routeId,
      radiusKm ?? 5,
    );

    // 2. Get route distance for range calculation
    const routeDistanceKm = await this.fuelStopsService.getRouteDistanceKm(routeId);

    // 3. Get bike-specific fuel data or use defaults
    let tankLiters = 15;
    let kmPerLiter = 18;

    if (bikeId) {
      const bikeData = await this.fuelStopsService.getBikeFuelData(bikeId);
      tankLiters = bikeData.tankLiters;
      kmPerLiter = bikeData.kmPerLiter;
    }

    // 4. Calculate range summary
    const effectiveRange = this.fuelStopsService.calculateEffectiveRange(tankLiters, kmPerLiter);
    const rangeSummary = this.fuelStopsService.computeFuelRangeSummary(
      routeDistanceKm,
      effectiveRange,
    );

    return { fuelStops, rangeSummary };
  }

  /**
   * Get just the fuel stops near a route (no bike/range data needed).
   */
  @Query(() => [FuelStop])
  @Public()
  async fuelStops(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
    @Args('radiusKm', { type: () => Float, nullable: true, defaultValue: 5 })
    radiusKm?: number,
  ): Promise<FuelStop[]> {
    return this.fuelStopsService.getFuelStopsNearRoute(routeId, radiusKm ?? 5);
  }
}
