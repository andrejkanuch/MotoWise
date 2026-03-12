import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { GqlExpenseCategory } from '../../../common/enums/graphql-enums';

@ObjectType()
export class Expense {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  motorcycleId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => GqlExpenseCategory)
  category: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  date: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
