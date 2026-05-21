import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { LearningProgressService } from './learning-progress.service';
import { LearningProgress } from './models/learning-progress.model';

@Resolver(() => LearningProgress)
export class LearningProgressResolver {
  constructor(private readonly progressService: LearningProgressService) {}

  @Query(() => [LearningProgress])
  async myProgress(@CurrentUser() user: AuthUser): Promise<LearningProgress[]> {
    return this.progressService.findByUser(user.id);
  }

  @Mutation(() => LearningProgress)
  async markArticleRead(
    @CurrentUser() user: AuthUser,
    @Args('articleId', ParseUUIDPipe) articleId: string,
  ): Promise<LearningProgress> {
    return this.progressService.markRead(user.id, articleId);
  }
}
