import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { RiderInsightsResolver } from './rider-insights.resolver';
import { RiderInsightsService } from './rider-insights.service';

@Module({
  imports: [WebhooksModule],
  providers: [RiderInsightsResolver, RiderInsightsService],
})
export class RiderInsightsModule {}
