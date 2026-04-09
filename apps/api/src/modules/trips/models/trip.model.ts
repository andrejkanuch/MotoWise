import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TripOrganiser {
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
export class TripWaypoint {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  tripId: string;

  @Field(() => Int)
  sortOrder: number;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field()
  createdAt: string;
}

@ObjectType()
export class TripParticipant {
  @Field(() => ID)
  id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field()
  role: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  bikeId?: string;

  @Field()
  joinedAt: string;
}

@ObjectType()
export class Trip {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;

  @Field(() => Int)
  participantCount: number;

  @Field()
  status: string;

  @Field({ nullable: true })
  coverImageUrl?: string;

  @Field()
  createdAt: string;

  @Field(() => TripOrganiser)
  organiser: TripOrganiser;

  @Field(() => [TripWaypoint], { nullable: true })
  waypoints?: TripWaypoint[];

  @Field(() => [TripParticipant], { nullable: true })
  participants?: TripParticipant[];
}

@ObjectType()
export class TripEdge {
  @Field(() => Trip)
  node: Trip;

  @Field()
  cursor: string;
}

@ObjectType()
export class TripPageInfo {
  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType()
export class TripConnection {
  @Field(() => [TripEdge])
  edges: TripEdge[];

  @Field(() => TripPageInfo)
  pageInfo: TripPageInfo;
}
