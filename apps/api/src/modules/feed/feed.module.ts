import { Module } from '@nestjs/common';
import { FeedResolver } from './feed.resolver';
import { FeedService } from './feed.service';

@Module({
  providers: [FeedResolver, FeedService],
})
export class FeedModule {}
