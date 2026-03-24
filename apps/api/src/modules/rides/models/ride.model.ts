import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GqlRideStatus } from '../../../common/enums/graphql-enums';

@ObjectType()
export class Ride {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  motorcycleId?: string;

  @Field(() => GqlRideStatus)
  status: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  startedAt: string;

  @Field({ nullable: true })
  endedAt?: string;

  @Field(() => Int, { nullable: true })
  durationS?: number;

  @Field(() => Int)
  pausedDurationS: number;

  @Field(() => Int)
  autoPausedDurationS: number;

  @Field(() => Int, { nullable: true })
  distanceM?: number;

  @Field(() => Float, { nullable: true })
  maxSpeedMps?: number;

  @Field(() => Float, { nullable: true })
  avgSpeedMps?: number;

  @Field(() => Float, { nullable: true })
  maxLeanAngle?: number;

  @Field(() => Float, { nullable: true })
  elevationGain?: number;

  @Field(() => Float, { nullable: true })
  elevationLoss?: number;

  @Field({ nullable: true })
  routePolyline?: string;

  @Field(() => Float, { nullable: true })
  gpsQuality?: number;

  @Field()
  mileageApplied: boolean;

  @Field()
  isPublic: boolean;

  @Field({ nullable: true })
  region?: string;

  @Field({ nullable: true })
  routeThumbnailUri?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
