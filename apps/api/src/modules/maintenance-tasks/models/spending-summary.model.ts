import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SpendingSummary {
  @Field(() => Float)
  thisYear: number;

  @Field(() => Float)
  allTime: number;
}
