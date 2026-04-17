import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { PeriodOfDayEnum } from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

@InputType()
export class CreateWaypointInput {
  @Field(() => ID)
  tripId: string;

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
