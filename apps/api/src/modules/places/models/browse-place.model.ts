import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Public place row for explore / browse (countries, regions)' })
export class BrowsePlace {
  @Field(() => ID)
  id: string;

  @Field()
  kind: string;

  @Field()
  name: string;

  @Field()
  countryCode: string;

  @Field({ nullable: true })
  regionCode?: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  parentId?: string;

  @Field(() => Int)
  routeCount: number;
}
