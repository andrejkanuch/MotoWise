import { Module } from '@nestjs/common';
import { MotorcyclesResolver } from './motorcycles.resolver';
import { MotorcyclesService } from './motorcycles.service';

@Module({
  providers: [MotorcyclesResolver, MotorcyclesService],
})
export class MotorcyclesModule {}
