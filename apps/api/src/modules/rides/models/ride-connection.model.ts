import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../articles/models/article-connection.model';
import { Ride } from './ride.model';

@ObjectType()
export class RideEdge {
  @Field(() => Ride)
  node: Ride;

  @Field()
  cursor: string;
}

@ObjectType()
export class RideConnection {
  @Field(() => [RideEdge])
  edges: RideEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}
