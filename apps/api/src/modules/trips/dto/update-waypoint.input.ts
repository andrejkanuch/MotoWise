import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { PeriodOfDayEnum } from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

@InputType()
export class UpdateWaypointInput {
  @Field(() => ID)
  waypointId: string;

  @Field({ nullable: true })
  type?: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Float, { nullable: true })
  lat?: number;

  @Field(() => Float, { nullable: true })
  lng?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Int, { nullable: true })
  sortOrder?: number;

  @Field(() => Int, { nullable: true })
  dayIndex?: number;

  @Field(() => PeriodOfDayEnum, { nullable: true })
  periodOfDay?: PeriodOfDay | null;
}
