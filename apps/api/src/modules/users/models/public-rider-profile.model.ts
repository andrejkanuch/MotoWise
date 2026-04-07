import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PublicRiderBike {
  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;

  @Field({ nullable: true })
  nickname?: string;
}

@ObjectType()
export class PublicRideStats {
  @Field(() => Int)
  totalRides: number;

  @Field()
  totalDistance: number;

  @Field()
  joinDate: string;
}

@ObjectType()
export class PublicRiderProfile {
  @Field(() => ID)
  id: string;

  @Field()
  publicUsername: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => Int)
  followerCount: number;

  @Field(() => Int)
  followingCount: number;

  /** Whether the requesting user follows this rider (null if unauthenticated) */
  @Field({ nullable: true })
  isFollowing?: boolean;

  @Field(() => [PublicRiderBike])
  bikes: PublicRiderBike[];

  @Field(() => PublicRideStats)
  rideStats: PublicRideStats;
}
