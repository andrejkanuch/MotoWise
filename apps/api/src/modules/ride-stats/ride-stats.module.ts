import { Module } from '@nestjs/common';
import { RideStatsSweepController } from './ride-stats.controller';
import { RideStatsListener } from './ride-stats.listener';
import { RideStatsService } from './ride-stats.service';

@Module({
  controllers: [RideStatsSweepController],
  providers: [RideStatsService, RideStatsListener],
  exports: [RideStatsService],
})
export class RideStatsModule {}
