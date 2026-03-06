import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Article } from './article.model';

@ObjectType()
export class ArticleEdge {
  @Field(() => Article)
  node: Article;

  @Field()
  cursor: string;
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;
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
