import { Module } from '@nestjs/common';
import { LearningProgressResolver } from './learning-progress.resolver';
import { LearningProgressService } from './learning-progress.service';

@Module({
  providers: [LearningProgressResolver, LearningProgressService],
})
export class LearningProgressModule {}
