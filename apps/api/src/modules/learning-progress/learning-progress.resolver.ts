import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { LearningProgressService } from './learning-progress.service';
import { LearningProgress } from './models/learning-progress.model';

@Resolver(() => LearningProgress)
export class LearningProgressResolver {
  constructor(private readonly progressService: LearningProgressService) {}

  @Query(() => [LearningProgress])
  @UseGuards(GqlAuthGuard)
  async myProgress(@CurrentUser() user: AuthUser): Promise<LearningProgress[]> {
    return this.progressService.findByUser(user.id);
  }

  @Mutation(() => LearningProgress)
  @UseGuards(GqlAuthGuard)
  async markArticleRead(
    @CurrentUser() user: AuthUser,
    @Args('articleId') articleId: string,
  ): Promise<LearningProgress> {
    return this.progressService.markRead(user.id, articleId);
  }
}
