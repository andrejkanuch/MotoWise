import { Field, Float, ObjectType } from '@nestjs/graphql';
import { CurrencyTotal } from './currency-total.model';
import { Expense } from './expense.model';

@ObjectType()
export class ExpenseCategory {
  @Field()
  category: string;

  @Field(() => Float, {
    description:
      "This category's spend in the bike's legacy currency (the one with the largest total, the same currency as ExpenseSummary.ytdTotal); 0 when the category has none. Never a cross-currency sum. Display currencyTotals instead.",
  })
  total: number;

  @Field(() => [CurrencyTotal], { description: 'Per-currency totals, most-used currency first' })
  currencyTotals: CurrencyTotal[];

  @Field(() => [Expense])
  expenses: Expense[];
}

@ObjectType()
export class ExpenseSummary {
  @Field(() => Float, {
    description:
      "Total of the bike's currency with the largest total only, never a cross-currency sum. Display currencyTotals instead.",
  })
  ytdTotal: number;

  @Field(() => [CurrencyTotal], {
    description: 'Per-currency totals, most-used currency first. Empty when there are no expenses.',
  })
  currencyTotals: CurrencyTotal[];

  @Field(() => [ExpenseCategory])
  categories: ExpenseCategory[];
}
