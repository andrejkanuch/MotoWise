import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { OemSchedulesModule } from '../oem-schedules/oem-schedules.module';
import { MakeStatsService } from './make-stats.service';
import { MotorcyclesResolver } from './motorcycles.resolver';
import { MotorcyclesService } from './motorcycles.service';
import { NhtsaService } from './nhtsa.service';

@Module({
  imports: [OemSchedulesModule, DocumentsModule],
  providers: [MotorcyclesResolver, MotorcyclesService, MakeStatsService, NhtsaService],
  // NhtsaService + MakeStatsService exported for the onboarding Reveal resolver.
  exports: [MotorcyclesService, MakeStatsService, NhtsaService],
})
export class MotorcyclesModule {}
