import { Module } from '@nestjs/common';
import { MotorcyclesResolver } from './motorcycles.resolver';
import { MotorcyclesService } from './motorcycles.service';
import { NhtsaService } from './nhtsa.service';

@Module({
  providers: [MotorcyclesResolver, MotorcyclesService, NhtsaService],
  exports: [MotorcyclesService],
})
export class MotorcyclesModule {}
