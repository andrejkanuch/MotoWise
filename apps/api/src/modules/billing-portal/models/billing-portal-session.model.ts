import { Field, ObjectType } from '@nestjs/graphql';
import { type BillingPortalStatus, BillingPortalStatusEnum } from '../billing-portal.constants';

@ObjectType({
  description:
    'A one-time Stripe Customer Portal link for a web (Stripe) subscriber to manage or cancel.',
})
export class BillingPortalSession {
  @Field(() => BillingPortalStatusEnum)
  status!: BillingPortalStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Short-lived portal URL; present only when status is ok.',
  })
  url!: string | null;
}
