import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { PeriodOfDayEnum } from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

@ObjectType()
export class SharedTripWaypoint {
  @Field(() => ID) id!: string;
  @Field(() => Int) sortOrder!: number;
  @Field(() => Int, { nullable: true }) dayIndex?: number | null;
  @Field(() => PeriodOfDayEnum, { nullable: true }) periodOfDay?: PeriodOfDay | null;
  @Field() type!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) notes?: string | null;
  @Field(() => Float) lat!: number;
  @Field(() => Float) lng!: number;
}
