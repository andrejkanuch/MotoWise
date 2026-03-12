import { SubmitQuizSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SubmitQuizInput } from './dto/submit-quiz.input';
import { Quiz, QuizAttempt } from './models/quiz.model';
import { QuizzesService } from './quizzes.service';

@Resolver(() => Quiz)
export class QuizzesResolver {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Query(() => Quiz, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async quizByArticle(@Args('articleId', ParseUUIDPipe) articleId: string): Promise<Quiz | null> {
    return this.quizzesService.findByArticle(articleId);
  }

  @Mutation(() => QuizAttempt)
  @UseGuards(GqlAuthGuard)
  async submitQuiz(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SubmitQuizSchema)) input: SubmitQuizInput,
  ): Promise<QuizAttempt> {
    return this.quizzesService.submitAttempt(user.id, input);
  }
}
