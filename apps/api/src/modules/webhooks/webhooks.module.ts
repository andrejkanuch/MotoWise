import { Module } from '@nestjs/common';
import { MetaModule } from '../meta/meta.module';
import { RevenueCatWebhookController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';

@Module({
  imports: [MetaModule],
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatService],
  exports: [RevenueCatService],
})
export class WebhooksModule {}
