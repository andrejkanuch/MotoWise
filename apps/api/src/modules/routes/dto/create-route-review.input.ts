import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateRouteReviewInput {
  @Field(() => ID)
  routeId: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  text?: string;

  @Field(() => [String], { nullable: true })
  conditionTags?: string[];

  @Field(() => ID, { nullable: true })
  bikeId?: string;
}
