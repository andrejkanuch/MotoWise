import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class EndRideInput {
  @Field()
  rideId: string;

  @Field()
  endedAt: string;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Float, { nullable: true })
  maxSpeedMps?: number;

  @Field(() => Float, { nullable: true })
  avgSpeedMps?: number;

  @Field(() => Float, { nullable: true })
  elevationGain?: number;

  @Field(() => Float, { nullable: true })
  elevationLoss?: number;

  @Field({ nullable: true })
  routePolyline?: string;

  @Field(() => Float, { nullable: true })
  gpsQuality?: number;

  @Field(() => Int, { defaultValue: 0 })
  pausedDurationS: number;

  @Field(() => Int, { defaultValue: 0 })
  autoPausedDurationS: number;

  @Field(() => Float, { nullable: true })
  maxLeanAngle?: number;
}
