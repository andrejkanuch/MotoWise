import { Field, ID, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { BlogTranslationInput } from './blog-translation.input';

@InputType()
export class UpdateBlogPostInput {
  @Field(() => ID)
  id: string;

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

  @Field(() => GraphQLJSON, { nullable: true })
  typeData?: Record<string, unknown>;

  @Field(() => [BlogTranslationInput], { nullable: true })
  translations?: BlogTranslationInput[];

  @Field(() => [ID], { nullable: true })
  categoryIds?: string[];

  @Field(() => [ID], { nullable: true })
  keywordIds?: string[];
}
