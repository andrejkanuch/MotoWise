import { FollowRiderInputSchema, UnfollowRiderInputSchema } from '@motovault/types';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FollowRiderInput, UnfollowRiderInput } from './dto/follow.input';
import { FollowsService } from './follows.service';
import { Follow } from './models/follow.model';
import { FollowConnection } from './models/follow-connection.model';

@Resolver(() => Follow)
export class FollowsResolver {
  constructor(private readonly followsService: FollowsService) {}

  @Mutation(() => Follow)
  async followRider(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(FollowRiderInputSchema)) input: FollowRiderInput,
  ): Promise<Follow> {
    return this.followsService.follow(user.id, input.targetUserId);
  }

  @Mutation(() => Boolean)
  async unfollowRider(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UnfollowRiderInputSchema)) input: UnfollowRiderInput,
  ): Promise<boolean> {
    return this.followsService.unfollow(user.id, input.targetUserId);
  }

  @Query(() => FollowConnection)
  async getFollowers(
    @CurrentUser() user: AuthUser,
    @Args('userId') userId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<FollowConnection> {
    return this.followsService.getFollowers(user.id, userId, first, after);
  }

  @Query(() => FollowConnection)
  async getFollowing(
    @CurrentUser() user: AuthUser,
    @Args('userId') userId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<FollowConnection> {
    return this.followsService.getFollowing(user.id, userId, first, after);
  }
}
