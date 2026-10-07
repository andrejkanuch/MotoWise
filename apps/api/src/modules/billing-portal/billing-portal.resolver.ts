import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { THROTTLE_PRESETS } from '../../config/constants';
import { BillingPortalService } from './billing-portal.service';
import { BillingPortalSession } from './models/billing-portal-session.model';

@Resolver(() => BillingPortalSession)
export class BillingPortalResolver {
  constructor(private readonly billingPortalService: BillingPortalService) {}

  @Mutation(() => BillingPortalSession, {
    description:
      "Creates a Stripe Customer Portal session for the current user's web subscription, so they can manage or cancel it.",
  })
  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.BILLING_PORTAL })
  async createBillingPortalSession(@CurrentUser() user: AuthUser): Promise<BillingPortalSession> {
    return this.billingPortalService.createSession(user.id);
  }
}
