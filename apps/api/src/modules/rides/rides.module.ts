import { Module } from '@nestjs/common';
import { RideDerivedLoader } from './ride-derived.loader';
import { RidesResolver } from './rides.resolver';
import { RidesService } from './rides.service';

@Module({
  providers: [RidesResolver, RidesService, RideDerivedLoader],
  exports: [RidesService],
})
export class RidesModule {}
