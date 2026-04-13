import { Field, Float, ObjectType } from '@nestjs/graphql';
import { Route } from '../../routes/models/route.model';

@ObjectType()
export class RouteSearchEdge {
  @Field(() => Route)
  node: Route;

  @Field()
  cursor: string;

  @Field(() => Float)
  score: number;
}

@ObjectType()
export class RouteSearchPageInfo {
  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType()
export class RouteSearchConnection {
  @Field(() => [RouteSearchEdge])
  edges: RouteSearchEdge[];

  @Field(() => RouteSearchPageInfo)
  pageInfo: RouteSearchPageInfo;
}
