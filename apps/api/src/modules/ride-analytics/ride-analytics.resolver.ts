import { Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RideOverview } from './models/ride-overview.model';
import { RideAnalyticsService } from './ride-analytics.service';

@Resolver()
export class RideAnalyticsResolver {
  constructor(private readonly rideAnalyticsService: RideAnalyticsService) {}

  @Query(() => RideOverview)
  async rideOverview(@CurrentUser() user: AuthUser): Promise<RideOverview> {
    return this.rideAnalyticsService.getRideOverview(user.id);
  }
}
