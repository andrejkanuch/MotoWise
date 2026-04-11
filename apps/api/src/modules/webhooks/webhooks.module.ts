import { Module } from '@nestjs/common';
import { HealthReportsModule } from '../health-reports/health-reports.module';
import { RevenueCatWebhookController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';

@Module({
  imports: [HealthReportsModule],
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatService],
  exports: [RevenueCatService],
})
export class WebhooksModule {}
