import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class ShareRideToDiscoverInput {
  @Field(() => ID)
  rideId: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  surfaceType?: string;
}
