import { Module } from '@nestjs/common';
import { RideAnalyticsResolver } from './ride-analytics.resolver';
import { RideAnalyticsService } from './ride-analytics.service';
import { RideRecordDetector } from './ride-record-detector.service';
import { RideRollupAggregator } from './ride-rollup-aggregator.service';

@Module({
  providers: [
    RideAnalyticsResolver,
    RideAnalyticsService,
    RideRollupAggregator,
    RideRecordDetector,
  ],
  exports: [RideAnalyticsService, RideRecordDetector],
})
export class RideAnalyticsModule {}
