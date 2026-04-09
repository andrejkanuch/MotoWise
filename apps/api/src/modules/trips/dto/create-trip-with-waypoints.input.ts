import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class InlineWaypointInput {
  @Field()
  type: string;

  @Field()
  name: string;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Int)
  sortOrder: number;

  @Field(() => Int, { defaultValue: 0 })
  dayIndex: number;
}

@InputType()
export class CreateTripWithWaypointsInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;

  @Field(() => [InlineWaypointInput])
  waypoints: InlineWaypointInput[];
}
