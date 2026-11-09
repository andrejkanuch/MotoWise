import { Args, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RideOverview } from './models/ride-overview.model';
import { RideAnalyticsService } from './ride-analytics.service';

@Resolver()
export class RideAnalyticsResolver {
  constructor(private readonly rideAnalyticsService: RideAnalyticsService) {}

  @Query(() => RideOverview)
  async rideOverview(
    @CurrentUser() user: AuthUser,
    @Args('timeZone', {
      type: () => String,
      nullable: true,
      description:
        'IANA zone for the day, week and month buckets; defaults to the rider’s latest ride zone, then UTC.',
    })
    timeZone?: string | null,
  ): Promise<RideOverview> {
    return this.rideAnalyticsService.getRideOverview(user.id, timeZone);
  }
}
