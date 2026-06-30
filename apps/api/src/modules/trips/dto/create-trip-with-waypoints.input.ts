import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { PeriodOfDayEnum } from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

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

  @Field(() => PeriodOfDayEnum, { nullable: true })
  periodOfDay?: PeriodOfDay;
}

@InputType()
export class CreateTripWithWaypointsInput {
  @Field()
  title: string;

  @Field()
  description: string;

  // Optional: a showcase ("Already rode it") is dateless. Required for a
  // planned trip — enforced by CreateTripWithWaypointsInputSchema.
  @Field({ nullable: true })
  startDate?: string;

  @Field({ nullable: true })
  endDate?: string;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;

  @Field(() => [InlineWaypointInput])
  waypoints: InlineWaypointInput[];

  // Privacy feature: 'private' | 'unlisted' | 'public'. Defaults to 'private'.
  @Field({ nullable: true })
  visibility?: string;

  // Showcase ("Already rode it"): dateless trip parameterised by dayCount.
  @Field({ nullable: true })
  isShowcase?: boolean;

  @Field(() => Int, { nullable: true })
  dayCount?: number;
}
