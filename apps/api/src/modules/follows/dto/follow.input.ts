import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class FollowRiderInput {
  @Field()
  targetUserId: string;
}

@InputType()
export class UnfollowRiderInput {
  @Field()
  targetUserId: string;
}
