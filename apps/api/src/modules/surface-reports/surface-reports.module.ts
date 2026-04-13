import { Module } from '@nestjs/common';
import { SurfaceReportsResolver } from './surface-reports.resolver';
import { SurfaceReportsService } from './surface-reports.service';

@Module({
  providers: [SurfaceReportsResolver, SurfaceReportsService],
  exports: [SurfaceReportsService],
})
export class SurfaceReportsModule {}
