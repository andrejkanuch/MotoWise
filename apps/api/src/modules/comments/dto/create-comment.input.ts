import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateCommentInput {
  @Field(() => ID, { nullable: true })
  rideId?: string;

  @Field(() => ID, { nullable: true })
  routeId?: string;

  @Field(() => ID, { nullable: true })
  groupRideId?: string;

  @Field(() => ID, { nullable: true })
  tripId?: string;

  @Field(() => ID, { nullable: true })
  parentCommentId?: string;

  @Field()
  text: string;
}
