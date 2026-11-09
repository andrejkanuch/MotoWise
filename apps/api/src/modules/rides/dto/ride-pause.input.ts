import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RidePauseInput {
  @Field()
  rideId: string;
}
