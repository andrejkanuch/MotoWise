import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class ReorderWaypointsInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => [ID])
  waypointIds: string[];
}
