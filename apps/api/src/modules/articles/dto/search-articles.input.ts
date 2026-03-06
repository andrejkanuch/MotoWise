import { Field, InputType, Int } from '@nestjs/graphql';
import {
  GqlArticleCategory,
  GqlArticleDifficulty,
} from '../../../common/enums/graphql-enums';

@InputType()
export class SearchArticlesInput {
  @Field({ nullable: true })
  query?: string;

  @Field(() => GqlArticleCategory, { nullable: true })
  category?: string;

  @Field(() => GqlArticleDifficulty, { nullable: true })
  difficulty?: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  first?: number;

  @Field({ nullable: true })
  after?: string;
}
