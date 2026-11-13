import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { GqlUserRole } from '../../../common/enums/graphql-enums';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field(() => GqlUserRole)
  role: string;

  @Field(() => GraphQLJSON, { nullable: true })
  preferences?: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  subscriptionTier?: string;

  /** True once any store has granted this account a free trial (users.trial_started_at). */
  @Field({ nullable: true })
  hasUsedTrial?: boolean;

  @Field({ nullable: true })
  measurementSystem?: string;

  @Field()
  currency: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  isPublic?: boolean;

  @Field({ nullable: true })
  followerCount?: number;

  @Field({ nullable: true })
  followingCount?: number;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  handle?: string;

  @Field({ nullable: true })
  showSavedPublicly?: boolean;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  /**
   * activation T07a: set only on the `completeOnboarding` result — OEM tasks the
   * onboarding bike's service plan holds after the import. Null on every other
   * query, and when onboarding created no bike or the import failed.
   */
  @Field(() => Int, {
    nullable: true,
    description:
      'Only on the completeOnboarding result: OEM service-plan tasks the onboarding bike has; null elsewhere',
  })
  servicePlanTaskCount?: number;

  /** activation T07a: the waterfall tier of that plan (`SERVICE_PLAN_TIER`); same nullability. */
  @Field(() => String, {
    nullable: true,
    description:
      'Only on the completeOnboarding result: service-plan tier (model | make | generic); null elsewhere',
  })
  servicePlanTier?: string;
}
