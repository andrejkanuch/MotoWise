import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class LatLngInput {
  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;
}

@InputType()
export class SearchRoutesFilterInput {
  @Field(() => Float, { nullable: true })
  minKm?: number;

  @Field(() => Float, { nullable: true })
  maxKm?: number;

  @Field(() => [String], { nullable: true })
  surfaceTypes?: string[];

  @Field({ nullable: true })
  countryCode?: string;

  @Field({ nullable: true })
  regionCode?: string;
}
