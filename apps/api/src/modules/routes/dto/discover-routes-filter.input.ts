import { Field, Float, InputType, Int } from '@nestjs/graphql';

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

  @Field(() => Int, { nullable: true, description: 'Minimum twist score 1-10 (maps to curvature_index thresholds)' })
  minTwistScore?: number;

  @Field(() => Int, { nullable: true, description: 'Only routes with surface condition reports within the last N days' })
  surfaceRecency?: number;
}
