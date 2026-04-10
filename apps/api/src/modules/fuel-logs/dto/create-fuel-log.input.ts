import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class CreateFuelLogInput {
  @Field()
  motorcycleId: string;

  @Field(() => Float)
  odometerKm: number;

  @Field(() => Float)
  fuelLitres: number;

  @Field(() => Float, { nullable: true })
  totalCost?: number;

  @Field({ nullable: true })
  currency?: string;

  @Field({ nullable: true })
  fuelType?: string;

  @Field({ nullable: true })
  isPartial?: boolean;

  @Field({ nullable: true })
  notes?: string;

  /** ISO date string. Defaults to now on the server. */
  @Field({ nullable: true })
  filledAt?: string;
}
