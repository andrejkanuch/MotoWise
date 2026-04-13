import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * PublicRoute — safe-for-anonymous subset of Route.
 * Gated fields (polyline, editorialDescription) are excluded entirely.
 * Used by SEO/public pages where no auth token is present.
 */
@ObjectType()
export class PublicRoute {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Float, { nullable: true })
  elevationGainM?: number;

  @Field({ nullable: true })
  surfaceType?: string;

  @Field()
  isMotovaultPick: boolean;

  @Field(() => Float, { nullable: true })
  ratingAvg?: number;

  @Field(() => Int)
  ratingCount: number;

  @Field(() => Int)
  commentCount: number;

  @Field({ nullable: true })
  countryCode?: string;

  @Field({ nullable: true })
  regionCode?: string;

  @Field({ nullable: true })
  city?: string;

  @Field(() => Float, { nullable: true })
  startLat?: number;

  @Field(() => Float, { nullable: true })
  startLng?: number;

  @Field(() => Float, { nullable: true })
  twistScore?: number;
}
