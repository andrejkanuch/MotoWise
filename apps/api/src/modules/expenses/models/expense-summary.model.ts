import { Field, Float, ObjectType } from '@nestjs/graphql';
import { GqlExpenseCategory } from '../../../common/enums/graphql-enums';
import { Expense } from './expense.model';

@ObjectType()
export class CategoryGroup {
  @Field(() => GqlExpenseCategory)
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

  @Field(() => [CategoryGroup])
  categories: CategoryGroup[];
}
