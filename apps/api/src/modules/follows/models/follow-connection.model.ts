import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../../common/models/page-info.model';
import { Follow } from './follow.model';

@ObjectType()
export class FollowEdge {
  @Field(() => Follow)
  node: Follow;

  @Field()
  cursor: string;
}

@ObjectType()
export class FollowConnection {
  @Field(() => [FollowEdge])
  edges: FollowEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}
