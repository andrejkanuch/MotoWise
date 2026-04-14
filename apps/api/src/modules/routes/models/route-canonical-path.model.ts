import { Field, ObjectType } from '@nestjs/graphql';

/** Minimal path segments for canonical /route/{country}/{region}/{slug} URLs. */
@ObjectType()
export class RouteCanonicalPath {
  @Field()
  countryCode: string;

  @Field()
  regionCode: string;

  @Field()
  slug: string;
}
