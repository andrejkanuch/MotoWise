import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AiBudgetStatus {
  @Field()
  circuitBreakerOpen: boolean;

  @Field(() => Int)
  todaySpendCents: number;

  @Field(() => Int)
  todayGenerationCount: number;

  @Field(() => Int)
  dailySpendCapCents: number;
}
