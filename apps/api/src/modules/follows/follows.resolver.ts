import { FollowRiderInputSchema, UnfollowRiderInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { FollowRiderInput, UnfollowRiderInput } from './dto/follow.input';
import { FollowsService } from './follows.service';
import { Follow } from './models/follow.model';
import { FollowConnection } from './models/follow-connection.model';

@Resolver(() => Follow)
@UseGuards(GqlAuthGuard)
export class FollowsResolver {
  constructor(private readonly followsService: FollowsService) {}

  @Mutation(() => Follow)
  @Throttle({ default: THROTTLE_PRESETS.FOLLOW })
  async followRider(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(FollowRiderInputSchema)) input: FollowRiderInput,
  ): Promise<Follow> {
    return this.followsService.follow(user.id, input.targetUserId);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.FOLLOW })
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
