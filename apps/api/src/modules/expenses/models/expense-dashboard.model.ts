import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CategoryTotal {
  @Field()
  category: string;

  @Field(() => Float)
  total: number;
}

@ObjectType()
export class MonthlyBucket {
  @Field(() => Int)
  month: number;

  @Field(() => Int)
  year: number;

  // Generic per-category breakdown for the month. Only categories with spend are
  // present (no zero padding). Replaced the previous 11 hardcoded Float columns,
  // so new categories flow through without a schema change.
  @Field(() => [CategoryTotal])
  categories: CategoryTotal[];

  @Field(() => Float)
  total: number;
}

@ObjectType()
export class ExpenseDashboardSummary {
  @Field(() => Float)
  currentYearTotal: number;

  @Field(() => Float)
  previousYearTotal: number;

  @Field(() => Float)
  allTimeTotal: number;

  @Field(() => Int)
  expenseCount: number;

  @Field(() => [MonthlyBucket])
  monthlyBuckets: MonthlyBucket[];

  @Field(() => [CategoryTotal])
  categoryTotals: CategoryTotal[];
}
