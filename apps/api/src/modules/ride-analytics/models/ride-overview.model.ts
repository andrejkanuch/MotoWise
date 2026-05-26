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

  @Field({ nullable: true })
  summaryTitle?: string;
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
export class DailyDistance {
  @Field()
  date: string;

  @Field(() => Float)
  distanceM: number;
}

@ObjectType()
export class RideOverview {
  @Field(() => LastRideSummary, { nullable: true })
  lastRide?: LastRideSummary;

  @Field(() => RidePeriodSummary)
  last7Days: RidePeriodSummary;

  @Field(() => RidePeriodSummary)
  last30Days: RidePeriodSummary;

  @Field(() => RidePeriodSummary)
  thisWeek: RidePeriodSummary;

  @Field(() => RidePeriodSummary)
  thisMonth: RidePeriodSummary;

  @Field(() => [DailyDistance])
  dailyDistances: DailyDistance[];

  @Field(() => Int)
  currentStreak: number;

  @Field(() => [RideRecord])
  personalRecords: RideRecord[];
}
