import { Module } from '@nestjs/common';
import { BillingPortalResolver } from './billing-portal.resolver';
import { BillingPortalService } from './billing-portal.service';

@Module({
  providers: [BillingPortalResolver, BillingPortalService],
})
export class BillingPortalModule {}
