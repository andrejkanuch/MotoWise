import { Field, Float, ObjectType } from '@nestjs/graphql';
import { CurrencyTotal } from './currency-total.model';
import { Expense } from './expense.model';

@ObjectType()
export class ExpenseCategory {
  @Field()
  category: string;

  @Field(() => Float, {
    description:
      "Total of this category's most-used currency only, never a cross-currency sum. Display currencyTotals instead.",
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
      "Total of the bike's most-used currency only, never a cross-currency sum. Display currencyTotals instead.",
  })
  ytdTotal: number;

  @Field(() => [CurrencyTotal], {
    description: 'Per-currency totals, most-used currency first. Empty when there are no expenses.',
  })
  currencyTotals: CurrencyTotal[];

  @Field(() => [ExpenseCategory])
  categories: ExpenseCategory[];
}
