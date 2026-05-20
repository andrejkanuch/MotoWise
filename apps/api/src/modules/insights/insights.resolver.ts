import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GenerateInsightsInput } from './dto/generate-insights.input';
import { InsightsService } from './insights.service';
import { OnboardingInsight } from './models/onboarding-insight.model';

@Resolver(() => OnboardingInsight)
export class InsightsResolver {
  constructor(private readonly insightsService: InsightsService) {}

  @Mutation(() => [OnboardingInsight])
  async generateOnboardingInsights(
    @CurrentUser() user: AuthUser,
    @Args('input') input: GenerateInsightsInput,
  ): Promise<OnboardingInsight[]> {
    return this.insightsService.generate(user.id, input);
  }
}
