import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Minimal trip data for XML sitemap generation' })
export class SitemapTripEntry {
  @Field()
  countryCode: string;

  @Field()
  regionCode: string;

  @Field()
  slug: string;

  @Field()
  updatedAt: string;
}
