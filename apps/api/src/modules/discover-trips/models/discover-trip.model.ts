import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  DiscoverTripStatusEnum,
  SurfaceTypeEnum,
  TripDifficultyEnum,
} from '../../../shared/graphql/enums';

@ObjectType()
export class DiscoverTripWaypoint {
  @Field(() => Int)
  sortOrder: number;

  @Field(() => Int)
  dayIndex: number;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field({ nullable: true })
  notes?: string | null;
}

@ObjectType()
export class DiscoverTripContributor {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@ObjectType()
export class DiscoverTrip {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => TripDifficultyEnum)
  difficulty: string;

  @Field(() => Int)
  dayCount: number;

  @Field(() => [DiscoverTripWaypoint])
  waypoints: DiscoverTripWaypoint[];

  @Field({ nullable: true })
  polyline?: string;

  @Field(() => Float, { nullable: true })
  startLat?: number;

  @Field(() => Float, { nullable: true })
  startLng?: number;

  @Field(() => DiscoverTripContributor)
  contributor: DiscoverTripContributor;

  @Field()
  countryCode: string;

  @Field({ nullable: true })
  regionCode?: string;

  @Field({ nullable: true })
  city?: string;

  @Field(() => Int, { nullable: true })
  distanceM?: number;

  @Field(() => Int, { nullable: true })
  elevationGainM?: number;

  @Field(() => Int, { nullable: true })
  estimatedDurationMinutes?: number;

  @Field(() => SurfaceTypeEnum, { nullable: true })
  surfaceType?: string;

  @Field(() => Float, { nullable: true })
  curvatureIndex?: number;

  @Field(() => DiscoverTripStatusEnum)
  status: string;

  @Field()
  isFeatured: boolean;

  @Field()
  isMotovaultPick: boolean;

  @Field(() => Int)
  viewCount: number;

  @Field(() => Int)
  cloneCount: number;

  @Field(() => Float, { nullable: true })
  averageRating?: number;

  @Field(() => Int)
  reviewCount: number;

  @Field()
  publishedAt: string;

  @Field()
  updatedAt: string;

  @Field({ nullable: true, description: 'Set when this template was forked from another discover trip' })
  forkedFromDiscoverTripId?: string;
}

@ObjectType()
export class DiscoverTripEdge {
  @Field(() => DiscoverTrip)
  node: DiscoverTrip;

  @Field()
  cursor: string;
}

@ObjectType()
export class DiscoverTripPageInfo {
  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType()
export class DiscoverTripConnection {
  @Field(() => [DiscoverTripEdge])
  edges: DiscoverTripEdge[];

  @Field(() => DiscoverTripPageInfo)
  pageInfo: DiscoverTripPageInfo;
}

@ObjectType()
export class DiscoverTripReview {
  @Field(() => ID)
  id: string;

  @Field()
  discoverTripId: string;

  @Field({ nullable: true })
  userId?: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  text?: string;

  @Field(() => [String], { nullable: true })
  conditionTags?: string[];

  @Field({ nullable: true })
  bikeId?: string;

  @Field()
  createdAt: string;
}
