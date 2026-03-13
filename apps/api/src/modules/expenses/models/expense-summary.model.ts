import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Expense } from './expense.model';

@ObjectType()
export class ExpenseCategory {
  @Field()
  category: string;

  @Field(() => Float)
  total: number;

  @Field(() => [Expense])
  expenses: Expense[];
}

@ObjectType()
export class ExpenseSummary {
  @Field(() => Float)
  ytdTotal: number;

  @Field(() => [ExpenseCategory])
  categories: ExpenseCategory[];
}
