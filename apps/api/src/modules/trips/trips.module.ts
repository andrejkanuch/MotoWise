import '../../shared/graphql/enums';
import { Module } from '@nestjs/common';
import { TripsResolver } from './trips.resolver';
import { TripsService } from './trips.service';

@Module({
  providers: [TripsResolver, TripsService],
  exports: [TripsService],
})
export class TripsModule {}
