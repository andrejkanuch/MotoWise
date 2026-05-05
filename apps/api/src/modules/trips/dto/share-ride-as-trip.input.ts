import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class ShareRideAsTripInput {
  @Field(() => ID)
  rideId: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  surfaceType?: string;
}
