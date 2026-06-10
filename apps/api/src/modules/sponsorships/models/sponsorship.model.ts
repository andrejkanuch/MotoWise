import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  GqlSponsorshipPlacementType,
  GqlSponsorshipStatus,
} from '../../../common/enums/graphql-enums';

@ObjectType()
export class Sponsorship {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  sponsorId: string;

  @Field(() => ID)
  routeId: string;

  @Field(() => GqlSponsorshipPlacementType)
  placementType: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  ctaText?: string;

  @Field({ nullable: true })
  ctaUrl?: string;

  @Field(() => Int)
  impressionsCount: number;

  @Field(() => Int)
  clicksCount: number;

  @Field(() => GqlSponsorshipStatus)
  status: string;

  // costPerImpression / monthlyBudget / spentThisMonth are intentionally NOT
  // exposed: sponsor billing internals are not public API (audit H8).

  @Field()
  startsAt: Date;

  @Field({ nullable: true })
  endsAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
