import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../../common/models/page-info.model';
import { FeedRide } from './feed-ride.model';

@ObjectType()
export class FeedRideEdge {
  @Field(() => FeedRide)
  node: FeedRide;

  @Field()
  cursor: string;
}

@ObjectType()
export class FeedRideConnection {
  @Field(() => [FeedRideEdge])
  edges: FeedRideEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}
