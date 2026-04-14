import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SitemapRouteEntry {
  @Field()
  countryCode: string;

  @Field()
  regionCode: string;

  @Field()
  slug: string;

  @Field()
  updatedAt: string;
}
