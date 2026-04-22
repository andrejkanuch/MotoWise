import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateTripReviewInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  text?: string;

  @Field(() => [String], { nullable: true })
  conditionTags?: string[];

  @Field(() => ID, { nullable: true })
  bikeId?: string;
}
