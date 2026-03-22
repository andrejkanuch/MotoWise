import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class StartRideInput {
  @Field()
  rideId: string;

  @Field({ nullable: true })
  motorcycleId?: string;

  @Field()
  startedAt: string;
}
