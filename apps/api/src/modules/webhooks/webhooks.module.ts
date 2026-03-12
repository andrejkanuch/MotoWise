import { Module } from '@nestjs/common';
import { RevenueCatWebhookController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';

@Module({
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatService],
  exports: [RevenueCatService],
})
export class WebhooksModule {}
