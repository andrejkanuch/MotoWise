import { Args, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RiderInsights } from './models/rider-insights.model';
import { RiderInsightsService } from './rider-insights.service';

@Resolver()
export class RiderInsightsResolver {
  constructor(private readonly riderInsightsService: RiderInsightsService) {}

  @Query(() => RiderInsights, {
    description:
      'One season of the signed-in rider’s insights. Without from/to: the calendar year in the rider’s zone, or the previous year while the new one has fewer than five qualifying rides.',
  })
  async riderInsights(
    @CurrentUser() user: AuthUser,
    @Args('from', { type: () => String, nullable: true, description: 'YYYY-MM-DD, with to.' })
    from?: string | null,
    @Args('to', { type: () => String, nullable: true, description: 'YYYY-MM-DD, with from.' })
    to?: string | null,
    @Args('timeZone', {
      type: () => String,
      nullable: true,
      description: 'IANA zone; defaults to the rider’s latest ride zone, then UTC.',
    })
    timeZone?: string | null,
    @Args('refreshEntitlement', {
      type: () => Boolean,
      nullable: true,
      description: 'Re-read the RevenueCat entitlement first (right after a purchase).',
    })
    refreshEntitlement?: boolean | null,
  ): Promise<RiderInsights> {
    return this.riderInsightsService.getRiderInsights(user.id, {
      from,
      to,
      timeZone,
      refreshEntitlement,
    });
  }
}
