import { CreateCommentInputSchema } from '@motovault/types/validators';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CommentsService } from './comments.service';
import { CreateCommentInput } from './dto/create-comment.input';
import { Comment, CommentConnection } from './models/comment.model';

@Resolver(() => Comment)
@UseGuards(GqlAuthGuard)
export class CommentsResolver {
  constructor(private readonly commentsService: CommentsService) {}

  @Query(() => CommentConnection)
  async getComments(
    @CurrentUser() _user: AuthUser,
    @Args('rideId', { type: () => ID, nullable: true }) rideId?: string,
    @Args('routeId', { type: () => ID, nullable: true }) routeId?: string,
    @Args('groupRideId', { type: () => ID, nullable: true }) groupRideId?: string,
    @Args('tripId', { type: () => ID, nullable: true }) tripId?: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<CommentConnection> {
    const targetField = rideId
      ? 'ride_id'
      : routeId
        ? 'route_id'
        : tripId
          ? 'trip_id'
          : 'group_ride_id';
    const targetId = rideId ?? routeId ?? tripId ?? groupRideId ?? '';

    return this.commentsService.getComments(targetField, targetId, first ?? 20, after);
  }

  @Mutation(() => Comment)
  @Throttle({ default: THROTTLE_PRESETS.COMMENT })
  async createComment(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateCommentInputSchema))
    input: CreateCommentInput,
  ): Promise<Comment> {
    return this.commentsService.createComment(user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteComment(
    @CurrentUser() user: AuthUser,
    @Args('commentId', { type: () => ID }, ParseUUIDPipe) commentId: string,
  ): Promise<boolean> {
    return this.commentsService.deleteComment(commentId, user.id);
  }

  @Mutation(() => Boolean)
  @Throttle({ default: THROTTLE_PRESETS.COMMENT })
  async flagComment(
    @CurrentUser() _user: AuthUser,
    @Args('commentId', { type: () => ID }, ParseUUIDPipe) commentId: string,
  ): Promise<boolean> {
    return this.commentsService.flagComment(commentId);
  }
}
