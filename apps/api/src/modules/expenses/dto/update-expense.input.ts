import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateExpenseInput {
  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  date?: string;

  @Field({ nullable: true })
  description?: string;
}
