import { Module } from '@nestjs/common';
import { RideRecordDetector } from './ride-record-detector.service';
import { RideRollupAggregator } from './ride-rollup-aggregator.service';

@Module({
  providers: [RideRollupAggregator, RideRecordDetector],
  exports: [RideRecordDetector],
})
export class RideAnalyticsModule {}
