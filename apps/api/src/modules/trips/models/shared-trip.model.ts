import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { SharedTripParticipant } from './shared-trip-participant.model';
import { SharedTripWaypoint } from './shared-trip-waypoint.model';

@ObjectType()
export class SharedTrip {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field(() => String, { nullable: true }) description?: string | null;
  @Field() status!: string;
  @Field() difficulty!: string;
  @Field() startDate!: string;
  @Field() endDate!: string;
  @Field(() => Int) maxRiders!: number;
  @Field(() => Int) participantCount!: number;
  @Field(() => String, { nullable: true }) coverImageUrl?: string | null;
  @Field(() => [SharedTripWaypoint]) waypoints!: SharedTripWaypoint[];
  @Field(() => [SharedTripParticipant]) participants!: SharedTripParticipant[];
}
