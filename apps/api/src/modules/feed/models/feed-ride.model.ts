import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class FeedRider {
  @Field()
  displayName: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field()
  publicUsername: string;
}

@ObjectType()
export class FeedBike {
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
export class FeedRide {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => Int, { nullable: true })
  distanceM?: number;

  @Field(() => Float, { nullable: true })
  elevationGain?: number;

  @Field(() => Float, { nullable: true })
  elevationLoss?: number;

  @Field()
  startedAt: string;

  @Field({ nullable: true })
  endedAt?: string;

  @Field({ nullable: true })
  aiSummary?: string;

  @Field(() => Int)
  kudosCount: number;

  @Field(() => Int)
  commentCount: number;

  @Field()
  hasKudos: boolean;

  @Field({ nullable: true })
  routeThumbnailUri?: string;

  @Field(() => FeedRider)
  rider: FeedRider;

  @Field(() => FeedBike, { nullable: true })
  bike?: FeedBike;
}
