import { Module } from '@nestjs/common';
import { HealthReportsResolver } from './health-reports.resolver';
import { HealthReportsService } from './health-reports.service';

@Module({
  providers: [HealthReportsResolver, HealthReportsService],
  exports: [HealthReportsService],
})
export class HealthReportsModule {}
