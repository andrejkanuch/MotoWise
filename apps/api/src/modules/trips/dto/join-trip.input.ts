import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class JoinTripInput {
  @Field(() => ID)
  tripId: string;

  @Field({ nullable: true })
  status?: string;

  @Field(() => ID, { nullable: true })
  bikeId?: string;
}
