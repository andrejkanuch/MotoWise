import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../../common/models/page-info.model';
import { Article } from './article.model';

@ObjectType()
export class ArticleEdge {
  @Field(() => Article)
  node: Article;

  @Field()
  cursor: string;
}

@ObjectType()
export class ArticleConnection {
  @Field(() => [ArticleEdge])
  edges: ArticleEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}
