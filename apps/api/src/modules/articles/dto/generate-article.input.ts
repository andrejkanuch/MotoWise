import { Field, InputType } from '@nestjs/graphql';
import { GqlArticleCategory, GqlArticleDifficulty } from '../../../common/enums/graphql-enums';

@InputType()
export class GenerateArticleInput {
  @Field()
  topic: string;

  @Field(() => GqlArticleCategory, { nullable: true })
  category?: string;

  @Field(() => GqlArticleDifficulty, { nullable: true })
  difficulty?: string;
}
