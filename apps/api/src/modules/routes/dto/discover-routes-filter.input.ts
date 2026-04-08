import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class BoundsInput {
  @Field(() => Float)
  neLat: number;

  @Field(() => Float)
  neLng: number;

  @Field(() => Float)
  swLat: number;

  @Field(() => Float)
  swLng: number;
}

@InputType()
export class DiscoverRoutesFilterInput {
  @Field(() => BoundsInput, { nullable: true })
  bounds?: BoundsInput;

  @Field(() => Float, { nullable: true })
  nearLat?: number;

  @Field(() => Float, { nullable: true })
  nearLng?: number;

  @Field(() => Float, { nullable: true })
  radiusKm?: number;

  @Field(() => [String], { nullable: true })
  lengthRanges?: string[];

  @Field(() => [String], { nullable: true })
  surfaceTypes?: string[];

  @Field(() => [String], { nullable: true })
  elevationRanges?: string[];

  @Field({ nullable: true })
  highlyRatedOnly?: boolean;

  @Field({ nullable: true })
  bikeCategory?: string;
}
