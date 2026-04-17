import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';

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

  @Field(() => String, { nullable: true })
  periodOfDay?: string | null;
}
