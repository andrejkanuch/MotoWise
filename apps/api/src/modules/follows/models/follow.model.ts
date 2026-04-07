import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Follow {
  @Field(() => ID)
  followerId: string;

  @Field(() => ID)
  followingId: string;

  @Field()
  createdAt: string;

  /** Enriched user fields — populated when fetching follower/following lists */
  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}
