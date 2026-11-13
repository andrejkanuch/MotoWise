import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RideDerivedLoader } from './ride-derived.loader';
import { RidesResolver } from './rides.resolver';
import { RidesService } from './rides.service';

@Module({
  imports: [AnalyticsModule],
  providers: [RidesResolver, RidesService, RideDerivedLoader],
  exports: [RidesService],
})
export class RidesModule {}
