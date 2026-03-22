import { Module } from '@nestjs/common';
import { RidesResolver } from './rides.resolver';
import { RidesService } from './rides.service';

@Module({
  providers: [RidesResolver, RidesService],
  exports: [RidesService],
})
export class RidesModule {}
