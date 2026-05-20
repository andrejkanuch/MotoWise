import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FeedService } from './feed.service';
import { FeedRideConnection } from './models/feed-connection.model';
import { FeedRide } from './models/feed-ride.model';

@Resolver(() => FeedRide)
export class FeedResolver {
  constructor(private readonly feedService: FeedService) {}

  @Query(() => FeedRideConnection)
  async rideFeed(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<FeedRideConnection> {
    return this.feedService.getRideFeed(user.id, first, after);
  }
}
