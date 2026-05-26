import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { RideRecord } from './ride-record.model';

@ObjectType()
export class LastRideSummary {
  @Field()
  id: string;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Int)
  durationS: number;

  @Field(() => Float, { nullable: true })
  maxSpeedMps?: number;

  @Field()
  date: string;

  @Field({ nullable: true })
  motorcycleName?: string;
}

@ObjectType()
export class RidePeriodSummary {
  @Field(() => Int)
  rideCount: number;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Int)
  durationS: number;
}

@ObjectType()
export class RideOverview {
  @Field(() => LastRideSummary, { nullable: true })
  lastRide?: LastRideSummary;

  @Field(() => RidePeriodSummary)
  last7Days: RidePeriodSummary;

  @Field(() => RidePeriodSummary)
  thisWeek: RidePeriodSummary;

  @Field(() => RidePeriodSummary)
  thisMonth: RidePeriodSummary;

  @Field(() => Int)
  currentStreak: number;

  @Field(() => [RideRecord])
  personalRecords: RideRecord[];
}
