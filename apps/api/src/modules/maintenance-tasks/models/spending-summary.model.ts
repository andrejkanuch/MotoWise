import { Field, Float, ObjectType } from '@nestjs/graphql';
import { CurrencyTotal } from '../../expenses/models/currency-total.model';

/**
 * Completed-maintenance spend for one bike. Task money is stored in the
 * currency it was logged in and there is no FX source, so spend is reported
 * per currency (`*ByCurrency`, most-used first). The scalar fields keep their
 * pre-currency shape for older clients but hold the most-used currency only,
 * never a cross-currency sum.
 */
@ObjectType()
export class SpendingSummary {
  @Field(() => Float, {
    description:
      "This year's spend in the most-used currency only, never a cross-currency sum. Display thisYearByCurrency instead.",
  })
  thisYear: number;

  @Field(() => Float, {
    description:
      'All-time spend in the most-used currency only, never a cross-currency sum. Display allTimeByCurrency instead.',
  })
  allTime: number;

  @Field(() => [CurrencyTotal], {
    description: "This year's spend per currency, most-used first. Empty when there is none.",
  })
  thisYearByCurrency: CurrencyTotal[];

  @Field(() => [CurrencyTotal], {
    description: 'All-time spend per currency, most-used first. Empty when there is none.',
  })
  allTimeByCurrency: CurrencyTotal[];
}
