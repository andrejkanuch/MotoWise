import { Module } from '@nestjs/common';
import { QuizzesResolver } from './quizzes.resolver';
import { QuizzesService } from './quizzes.service';

@Module({
  providers: [QuizzesResolver, QuizzesService],
})
export class QuizzesModule {}
