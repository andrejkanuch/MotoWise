import type { CostTrendSection } from '@motovault/types';
import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CostTrendMonth {
  @Field({ description: 'YYYY-MM' })
  month: string;

  @Field(() => Float, { description: 'Spend in the series currency; 0 for a month with none.' })
  total: number;
}

/** One currency's monthly spend: every figure in it is in `currency`. */
@ObjectType()
export class CostTrendSeries {
  @Field({ description: 'ISO 4217 code every figure in this series is in' })
  currency: string;

  @Field(() => Int)
  expenseCount: number;

  @Field(() => Float, { description: 'Spend over the whole window.' })
  total: number;

  @Field(() => [CostTrendMonth], { description: 'Every month of the window, oldest first.' })
  months: CostTrendMonth[];
}

/**
 * Monthly expense totals for one bike, one series per currency, with months in
 * the rider's zone. A free rider gets the headline and the locked section
 * names; `series` is null and no money figure is in the response.
 */
@ObjectType()
export class CostTrend {
  @Field()
  isPro: boolean;

  @Field({ description: 'IANA zone that decides the current month.' })
  timeZone: string;

  @Field({ description: 'First month of the window, YYYY-MM.' })
  fromMonth: string;

  @Field({ description: 'Last month of the window (the current month), YYYY-MM.' })
  toMonth: string;

  @Field(() => Int, { description: 'Expenses in the window, every currency.' })
  expenseCount: number;

  @Field(() => String, {
    nullable: true,
    description:
      'Currency of the first series (most expenses in the window). Null when the window has no expenses.',
  })
  currency: string | null;

  @Field(() => Int, {
    description: 'Expenses in the window in a currency other than `currency`.',
  })
  otherCurrencyExpenseCount: number;

  @Field(() => [String], {
    description: 'Sections hidden from this rider (monthly_totals, period_totals). Empty for Pro.',
  })
  lockedSections: CostTrendSection[];

  @Field(() => [CostTrendSeries], {
    nullable: true,
    description: 'One series per currency, most expenses first. Null when the sections are locked.',
  })
  series: CostTrendSeries[] | null;
}
