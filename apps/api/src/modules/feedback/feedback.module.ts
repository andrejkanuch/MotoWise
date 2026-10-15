import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FeedbackResolver } from './feedback.resolver';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [UsersModule],
  providers: [FeedbackResolver, FeedbackService],
})
export class FeedbackModule {}
