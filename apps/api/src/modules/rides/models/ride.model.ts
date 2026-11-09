import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GqlRideStatus } from '../../../common/enums/graphql-enums';
import { RideDerivedStats } from './ride-derived-stats.model';

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

  // Privacy feature: 'private' | 'unlisted' | 'public'
  @Field()
  visibility: string;

  /** Where the ride started. When the stored value is empty, the start country's name. Public. */
  @Field({ nullable: true })
  region?: string;

  @Field({ nullable: true })
  routeThumbnailUri?: string;

  /** IANA zone the device reported at ride start. Owner only. */
  @Field({ nullable: true })
  timeZone?: string;

  /** How the ride ended (rider_phone, client_auto, server_idle, ...). Owner only. */
  @Field({ nullable: true })
  endSource?: string;

  /** Purpose the rider picked after the ride. Owner only. */
  @Field({ nullable: true })
  purpose?: string;

  /** Whether the rider carried a passenger. Owner only. */
  @Field({ nullable: true })
  passenger?: boolean;

  /** Nearest town to the start, from the ride's stats. Owner only. */
  @Field(() => String, { nullable: true })
  startPlace?: string | null;

  /** Nearest town to the end, from the ride's stats. Owner only. */
  @Field(() => String, { nullable: true })
  endPlace?: string | null;

  /** ISO codes of the countries the route crossed, in order of entry. Owner only. */
  @Field(() => [String], { nullable: true })
  countries?: string[] | null;

  /** Free derived stats. Owner only; null until the ride's stats are computed. */
  @Field(() => RideDerivedStats, { nullable: true })
  stats?: RideDerivedStats | null;

  /** Metres on roads not ridden before this ride. Owner and Pro only; null while stats are pending. */
  @Field(() => Int, { nullable: true })
  newRoadsM?: number | null;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
