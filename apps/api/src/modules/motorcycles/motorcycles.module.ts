import { Module } from '@nestjs/common';
import { OemSchedulesModule } from '../oem-schedules/oem-schedules.module';
import { MotorcyclesResolver } from './motorcycles.resolver';
import { MotorcyclesService } from './motorcycles.service';
import { NhtsaService } from './nhtsa.service';

@Module({
  imports: [OemSchedulesModule],
  providers: [MotorcyclesResolver, MotorcyclesService, NhtsaService],
  exports: [MotorcyclesService],
})
export class MotorcyclesModule {}
