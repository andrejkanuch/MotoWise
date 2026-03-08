import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { GqlArticleCategory, GqlArticleDifficulty } from '../../../common/enums/graphql-enums';

@ObjectType()
export class Article {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field(() => GqlArticleDifficulty)
  difficulty: string;

  @Field(() => GqlArticleCategory)
  category: string;

  @Field(() => Int)
  viewCount: number;

  @Field()
  isSafetyCritical: boolean;

  @Field()
  generatedAt: string;

  @Field()
  updatedAt: string;

  @Field(() => GraphQLJSON, { nullable: true })
  contentJson?: Record<string, unknown>;

  @Field(() => Int, { nullable: true })
  readTime?: number;
}
