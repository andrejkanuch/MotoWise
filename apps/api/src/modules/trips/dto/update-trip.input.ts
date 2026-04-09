import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateTripInput {
  @Field(() => ID)
  tripId: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  startDate?: string;

  @Field({ nullable: true })
  endDate?: string;

  @Field({ nullable: true })
  difficulty?: string;

  @Field(() => Int, { nullable: true })
  maxRiders?: number;
}
