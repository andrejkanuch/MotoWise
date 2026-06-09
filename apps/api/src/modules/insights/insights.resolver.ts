import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { THROTTLE_PRESETS } from '../../config/constants';
import { GenerateInsightsInput } from './dto/generate-insights.input';
import { InsightsService } from './insights.service';
import { OnboardingInsight } from './models/onboarding-insight.model';

@Resolver(() => OnboardingInsight)
export class InsightsResolver {
  constructor(private readonly insightsService: InsightsService) {}

  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.AI_INSIGHTS })
  @Mutation(() => [OnboardingInsight])
  async generateOnboardingInsights(
    @CurrentUser() user: AuthUser,
    @Args('input') input: GenerateInsightsInput,
  ): Promise<OnboardingInsight[]> {
    return this.insightsService.generate(user.id, input);
  }
}
