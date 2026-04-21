import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class PublishTripToDiscoverInput {
  @Field(() => ID)
  tripId: string;
}
