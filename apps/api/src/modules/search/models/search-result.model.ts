import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RouteContributor {
  @Field(() => ID)
  id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@ObjectType()
export class Route {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true, description: 'Null for anonymous users (requires auth)' })
  polyline?: string;

  @Field(() => Float)
  distanceM: number;

  @Field(() => Float, { nullable: true })
  elevationGainM?: number;

  @Field({ nullable: true })
  surfaceType?: string;

  @Field(() => Float, { nullable: true })
  curvatureIndex?: number;

  @Field(() => Int, { nullable: true })
  twistScore?: number;

  @Field(() => Int, { nullable: true })
  twistPercentile?: number;

  @Field()
  isMotovaultPick: boolean;

  @Field({ nullable: true })
  editorialDescription?: string;

  @Field(() => Float, { nullable: true })
  ratingAvg?: number;

  @Field(() => Int)
  ratingCount: number;

  @Field(() => Int)
  commentCount: number;

  @Field()
  status: string;

  @Field()
  createdAt: string;

  @Field(() => RouteContributor)
  contributor: RouteContributor;

  @Field(() => Float, { nullable: true })
  startLat?: number;

  @Field(() => Float, { nullable: true })
  startLng?: number;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  countryCode?: string;

  @Field({ nullable: true })
  regionCode?: string;

  @Field({ nullable: true })
  city?: string;
}

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
