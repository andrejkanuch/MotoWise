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

  @Field(() => Int, {
    nullable: true,
    description: 'Minimum twist score 1-10 (maps to curvature_index thresholds)',
  })
  minTwistScore?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Only routes with surface condition reports within the last N days',
  })
  surfaceRecency?: number;

  @Field({
    nullable: true,
    description: 'ISO 3166-1 alpha-2 country (e.g. IT, US); matched against routes.country_code',
  })
  countryCode?: string;

  @Field({
    nullable: true,
    description:
      'Region code as stored on routes.region_code (e.g. it-bz, us-ca), normalized to lowercase',
  })
  regionCode?: string;

  @Field({
    nullable: true,
    description: 'When true, only routes flagged as MotoVault editor picks',
  })
  motovaultPicksOnly?: boolean;

  @Field({
    nullable: true,
    description:
      'When true, order by rating (avg desc, then count desc). Cursor pagination (`after`) is not supported with this sort.',
  })
  sortByRating?: boolean;
}
