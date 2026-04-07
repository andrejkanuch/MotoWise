import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { RideSummary } from './models/ride-summary.model';
import { RideSummariesService } from './ride-summaries.service';

@Resolver(() => RideSummary)
@UseGuards(GqlAuthGuard)
export class RideSummariesResolver {
  constructor(private readonly rideSummariesService: RideSummariesService) {}

  @Mutation(() => RideSummary)
  @Throttle({ default: THROTTLE_PRESETS.RIDE_SUMMARY })
  async regenerateRideSummary(
    @CurrentUser() user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
    @Context() ctx: { req: { locale: string } },
  ): Promise<RideSummary> {
    const locale = ctx.req.locale ?? 'en';
    return this.rideSummariesService.generateSummary(rideId, user.id, locale);
  }
}
