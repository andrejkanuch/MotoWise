import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GroupRideOrganiser {
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
export class GroupRideParticipant {
  @Field(() => ID)
  id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field()
  joinedAt: string;
}

@ObjectType()
export class GroupRide {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  dateTime: string;

  @Field(() => Float)
  meetingPointLat: number;

  @Field(() => Float)
  meetingPointLng: number;

  @Field({ nullable: true })
  meetingPointName?: string;

  @Field(() => ID, { nullable: true })
  routeId?: string;

  @Field({ nullable: true })
  routeDescription?: string;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;

  @Field(() => Int)
  participantCount: number;

  @Field()
  status: string;

  @Field()
  createdAt: string;

  @Field(() => GroupRideOrganiser)
  organiser: GroupRideOrganiser;

  @Field(() => [GroupRideParticipant], { nullable: true })
  participants?: GroupRideParticipant[];
}

@ObjectType()
export class GroupRideEdge {
  @Field(() => GroupRide)
  node: GroupRide;

  @Field()
  cursor: string;
}

@ObjectType()
export class GroupRidePageInfo {
  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType()
export class GroupRideConnection {
  @Field(() => [GroupRideEdge])
  edges: GroupRideEdge[];

  @Field(() => GroupRidePageInfo)
  pageInfo: GroupRidePageInfo;
}
