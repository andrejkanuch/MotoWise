import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RouteReviewAuthor {
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
export class RouteReviewBike {
  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;
}

@ObjectType()
export class RouteReview {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  rating: number;

  @Field({ nullable: true })
  text?: string;

  @Field(() => [String])
  conditionTags: string[];

  @Field()
  createdAt: string;

  @Field(() => RouteReviewAuthor)
  author: RouteReviewAuthor;

  @Field(() => RouteReviewBike, { nullable: true })
  bike?: RouteReviewBike;
}

@ObjectType()
export class RouteReviewConnection {
  @Field(() => [RouteReview])
  reviews: RouteReview[];

  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;

  @Field(() => Int)
  totalCount: number;
}
