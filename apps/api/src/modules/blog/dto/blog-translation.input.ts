import { Field, InputType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class BlogTranslationInput {
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
}
