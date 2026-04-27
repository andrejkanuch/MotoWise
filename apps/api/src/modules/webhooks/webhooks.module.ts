import { Module } from '@nestjs/common';
import { HealthReportsModule } from '../health-reports/health-reports.module';
import { MetaModule } from '../meta/meta.module';
import { RevenueCatWebhookController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';

@Module({
  imports: [HealthReportsModule, MetaModule],
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatService],
  exports: [RevenueCatService],
})
export class WebhooksModule {}
