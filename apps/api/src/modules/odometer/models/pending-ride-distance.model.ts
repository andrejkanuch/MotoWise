import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PendingRideDistance {
  @Field(() => Int)
  rideCount: number;

  // Whole units of the bike's distance unit.
  @Field(() => Int)
  distance: number;
}
