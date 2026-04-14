import { Module } from '@nestjs/common';
import { FuelStopsResolver } from './fuel-stops.resolver';
import { FuelStopsService } from './fuel-stops.service';

@Module({
  providers: [FuelStopsResolver, FuelStopsService],
  exports: [FuelStopsService],
})
export class FuelStopsModule {}
