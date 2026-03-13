import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class LogExpenseInput {
  @Field()
  motorcycleId: string;

  @Field(() => Float)
  amount: number;

  @Field()
  category: string;

  @Field()
  date: string;

  @Field({ nullable: true })
  description?: string;
}
