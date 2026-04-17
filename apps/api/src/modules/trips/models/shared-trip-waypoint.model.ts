import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SharedTripWaypoint {
  @Field(() => ID) id!: string;
  @Field(() => Int) sortOrder!: number;
  @Field(() => Int, { nullable: true }) dayIndex?: number | null;
  @Field(() => String, { nullable: true }) periodOfDay?: string | null;
  @Field() type!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) notes?: string | null;
  @Field(() => Float) lat!: number;
  @Field(() => Float) lng!: number;
}
