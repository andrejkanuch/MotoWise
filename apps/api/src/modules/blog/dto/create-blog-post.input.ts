import { Field, ID, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { BlogTranslationInput } from './blog-translation.input';

@InputType()
export class CreateBlogPostInput {
  @Field()
  type: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  author?: string;

  @Field({ nullable: true })
  coverImage?: string;

  @Field({ nullable: true })
  coverAlt?: string;

  @Field({ nullable: true })
  specData?: boolean;

  @Field({ nullable: true })
  isSafetyCritical?: boolean;

  @Field({ nullable: true })
  scheduledFor?: string;

  /** Per-type fields; validated against the per-type Zod union. */
  @Field(() => GraphQLJSON)
  typeData: Record<string, unknown>;

  @Field(() => [BlogTranslationInput])
  translations: BlogTranslationInput[];

  @Field(() => [ID], { nullable: true })
  categoryIds?: string[];

  @Field(() => [ID], { nullable: true })
  keywordIds?: string[];
}
