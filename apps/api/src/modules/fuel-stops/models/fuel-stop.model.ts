import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class FuelStop {
  @Field(() => ID)
  osmId: string;

  @Field()
  name: string;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field()
  amenity: string;
}

@ObjectType()
export class FuelRangeSummary {
  @Field(() => Float)
  effectiveRangeKm: number;

  @Field(() => Int)
  stopsRequired: number;

  @Field()
  summary: string;
}

@ObjectType()
export class FuelRangeResult {
  @Field(() => [FuelStop])
  fuelStops: FuelStop[];

  @Field(() => FuelRangeSummary)
  rangeSummary: FuelRangeSummary;
}
