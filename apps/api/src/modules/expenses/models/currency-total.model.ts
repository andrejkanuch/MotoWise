import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

/** One currency's share of a money aggregate. Expense amounts are stored in the
 *  currency they were logged in and there is no FX source, so every total that
 *  spans expenses is reported per currency instead of as one summed number. */
@ObjectType()
export class CurrencyTotal {
  @Field({ description: 'ISO 4217 code' })
  currency: string;

  @Field(() => Float)
  total: number;

  @Field(() => Int, { description: 'Number of expenses summed into total' })
  count: number;
}
