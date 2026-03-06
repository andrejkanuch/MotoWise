import { Module } from '@nestjs/common';
import { QuizGeneratorService } from './quiz-generator.service';
import { QuizzesResolver } from './quizzes.resolver';
import { QuizzesService } from './quizzes.service';

@Module({
  providers: [QuizzesResolver, QuizzesService, QuizGeneratorService],
})
export class QuizzesModule {}
