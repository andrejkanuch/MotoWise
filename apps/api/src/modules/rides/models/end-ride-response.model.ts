import { Field, ObjectType } from '@nestjs/graphql';
import { Ride } from './ride.model';

@ObjectType()
export class TriggeredMaintenanceTask {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  priority: string;
}

@ObjectType()
export class EndRideResponse {
  @Field(() => Ride)
  ride: Ride;

  @Field(() => [TriggeredMaintenanceTask])
  triggeredMaintenanceTasks: TriggeredMaintenanceTask[];
}
