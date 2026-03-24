import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { THROTTLE_PRESETS } from '../../config/constants';
import { GenerateInsightsInput } from './dto/generate-insights.input';
import { InsightsService } from './insights.service';
import { OnboardingInsight } from './models/onboarding-insight.model';

@Resolver(() => OnboardingInsight)
export class InsightsResolver {
  constructor(private readonly insightsService: InsightsService) {}

  @Mutation(() => [OnboardingInsight])
  @UseGuards(GqlAuthGuard)
  @Throttle({ ai: THROTTLE_PRESETS.AI_INSIGHTS })
  async generateOnboardingInsights(
    @CurrentUser() user: AuthUser,
    @Args('input') input: GenerateInsightsInput,
  ): Promise<OnboardingInsight[]> {
    return this.insightsService.generate(user.id, input);
  }
}
