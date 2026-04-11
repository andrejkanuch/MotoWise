import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class FuelLog {
  @Field(() => ID)
  id: string;

  @Field()
  motorcycleId: string;

  @Field(() => Float)
  odometerKm: number;

  @Field(() => Float)
  fuelLitres: number;

  @Field(() => Float, { nullable: true })
  totalCost?: number;

  @Field()
  currency: string;

  @Field()
  fuelType: string;

  @Field()
  isPartial: boolean;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  filledAt: string;

  @Field()
  createdAt: string;

  // Computed fields — null on the first fill-up or after a partial fill
  @Field(() => Float, { nullable: true })
  kmSincePrevious?: number;

  @Field(() => Float, { nullable: true })
  litresPer100Km?: number;

  @Field(() => Float, { nullable: true })
  mpgUs?: number;
}
