import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { PeriodOfDayEnum } from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

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

  @Field(() => Int)
  dayIndex: number;

  @Field(() => PeriodOfDayEnum, { nullable: true })
  periodOfDay?: PeriodOfDay | null;

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
export class TripReviewAuthor {
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
export class TripReviewBike {
  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;

  @Field({ nullable: true })
  type?: string;
}

@ObjectType()
export class TripReview {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  tripId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  text?: string;

  @Field(() => [String], { nullable: true })
  conditionTags?: string[];

  @Field({ nullable: true })
  bikeId?: string;

  @Field(() => TripReviewAuthor, { nullable: true })
  author?: TripReviewAuthor;

  @Field(() => TripReviewBike, { nullable: true })
  bike?: TripReviewBike;

  @Field()
  createdAt: string;
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

  // True for a dateless trip (showcase / "Already rode it"): start_date and
  // end_date hold the sentinel 1970-01-01 and should not be displayed. Clients
  // gate date UI on this rather than on isTemplate.
  @Field({ nullable: true })
  datesPending?: boolean;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;

  @Field(() => Int)
  participantCount: number;

  @Field()
  status: string;

  @Field()
  visibility: string;

  @Field({ nullable: true })
  coverImageUrl?: string;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  updatedAt?: string;

  @Field(() => TripOrganiser)
  organiser: TripOrganiser;

  @Field(() => [TripWaypoint], { nullable: true })
  waypoints?: TripWaypoint[];

  @Field(() => [TripParticipant], { nullable: true })
  participants?: TripParticipant[];

  // Template fields (populated when is_template = true)

  @Field({ defaultValue: false })
  isTemplate: boolean;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  countryCode?: string;

  @Field({ nullable: true })
  regionCode?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  polyline?: string;

  @Field(() => Int, { nullable: true })
  distanceM?: number;

  @Field(() => Int, { nullable: true })
  elevationGainM?: number;

  @Field(() => Int, { nullable: true })
  estimatedDurationMinutes?: number;

  @Field({ nullable: true })
  surfaceType?: string;

  @Field(() => Float, { nullable: true })
  curvatureIndex?: number;

  @Field(() => Int, { nullable: true })
  dayCount?: number;

  @Field(() => Float, { nullable: true })
  startLat?: number;

  @Field(() => Float, { nullable: true })
  startLng?: number;

  @Field(() => Int, { defaultValue: 0 })
  viewCount: number;

  @Field(() => Int, { defaultValue: 0 })
  cloneCount: number;

  @Field(() => Float, { nullable: true })
  averageRating?: number;

  @Field(() => Int, { defaultValue: 0 })
  reviewCount: number;

  @Field({ defaultValue: false })
  isFeatured: boolean;

  @Field({ defaultValue: false })
  isMotovaultPick: boolean;

  @Field({ nullable: true })
  publishedAt?: string;

  @Field({ defaultValue: false })
  isFlagged: boolean;

  @Field(() => ID, { nullable: true })
  clonedFromTripId?: string;

  @Field(() => ID, { nullable: true })
  forkedFromTripId?: string;

  @Field(() => [TripReview], { nullable: true })
  reviews?: TripReview[];

  @Field({ nullable: true })
  isSaved?: boolean;
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
