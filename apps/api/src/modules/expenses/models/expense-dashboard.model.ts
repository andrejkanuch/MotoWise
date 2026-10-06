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

/** The full dashboard for ONE currency: every figure in it is in `currency`. */
@ObjectType()
export class ExpenseCurrencyBreakdown {
  @Field({ description: 'ISO 4217 code every figure in this breakdown is in' })
  currency: string;

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

/**
 * Expense dashboard for one bike. Amounts are never summed across currencies:
 * `currencies` holds one breakdown per currency (most-used first), and the
 * top-level money fields mirror the breakdown with the largest all-time total
 * (the currency 3.20.0 labels them with), so clients that predate `currencies`
 * show one correctly labelled currency's figures instead of a mixed sum.
 */
@ObjectType()
export class ExpenseDashboardSummary {
  @Field(() => String, {
    nullable: true,
    description:
      'Currency of the top-level money fields (the breakdown with the largest all-time total). Null when there are no expenses or the per-currency aggregate is unavailable.',
  })
  currency: string | null;

  @Field(() => [ExpenseCurrencyBreakdown], {
    description: 'One breakdown per currency, most-used first. Empty when there are no expenses.',
  })
  currencies: ExpenseCurrencyBreakdown[];

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
