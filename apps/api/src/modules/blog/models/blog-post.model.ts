import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

/**
 * Blog CMS GraphQL contract (plan U4). `BlogPost` is the single polymorphic
 * object type; per-type fields are surfaced via `typeData` (JSON), validated on
 * consumers through the per-type Zod schemas in @motovault/types (plan KTD3).
 * `type`/`status` are CHECK-constrained TEXT in the DB and exposed as strings.
 */

@ObjectType()
export class BlogTranslation {
  @Field()
  locale: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  excerpt?: string;

  @Field({ nullable: true })
  seoTitle?: string;

  @Field({ nullable: true })
  seoDescription?: string;

  @Field()
  bodyRaw: string;

  @Field(() => GraphQLJSON, { nullable: true })
  faq?: unknown;

  @Field({ nullable: true })
  readingTime?: string;

  @Field(() => Int, { nullable: true })
  wordCount?: number;
}

@ObjectType()
export class BlogCategory {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  name: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  isPrimary?: boolean;
}

@ObjectType()
export class BlogKeyword {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  name: string;
}

@ObjectType()
export class BlogPost {
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field()
  slug: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  publishedAt?: string;

  @Field({ nullable: true })
  scheduledFor?: string;

  @Field({ nullable: true })
  author?: string;

  @Field({ nullable: true })
  coverImage?: string;

  @Field({ nullable: true })
  coverAlt?: string;

  @Field()
  specData: boolean;

  @Field()
  isSafetyCritical: boolean;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  /** Per-type fields (guide/maintenance/trip/gear), camelCased; parse via per-type Zod. */
  @Field(() => GraphQLJSON, { nullable: true })
  typeData?: Record<string, unknown>;

  @Field(() => [BlogTranslation])
  translations: BlogTranslation[];

  @Field(() => [BlogCategory])
  categories: BlogCategory[];

  @Field(() => [BlogKeyword])
  keywords: BlogKeyword[];
}
