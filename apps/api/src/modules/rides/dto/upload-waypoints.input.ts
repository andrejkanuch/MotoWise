import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class WaypointInput {
  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => Float, { nullable: true })
  altitude?: number;

  @Field(() => Float, { nullable: true })
  speedMps?: number;

  @Field(() => Float, { nullable: true })
  heading?: number;

  @Field(() => Float, { nullable: true })
  accuracy?: number;

  @Field()
  recordedAt: string;
}

@InputType()
export class UploadWaypointsInput {
  @Field()
  rideId: string;

  @Field(() => [WaypointInput])
  waypoints: WaypointInput[];
}
