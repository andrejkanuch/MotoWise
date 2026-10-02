import { Module } from '@nestjs/common';
import { MotorcyclesModule } from '../motorcycles/motorcycles.module';
import { OdometerResolver } from './odometer.resolver';
import { OdometerService } from './odometer.service';

@Module({
  imports: [MotorcyclesModule],
  providers: [OdometerResolver, OdometerService],
})
export class OdometerModule {}
