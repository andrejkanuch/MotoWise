import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateParticipantStatusInput {
  @Field(() => ID)
  tripId: string;

  @Field()
  status: string;
}
