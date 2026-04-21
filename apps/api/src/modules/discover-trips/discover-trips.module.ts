import '../../shared/graphql/enums';
import { Module } from '@nestjs/common';
import { TripsModule } from '../trips/trips.module';
import { DiscoverTripsResolver } from './discover-trips.resolver';
import { DiscoverTripsService } from './discover-trips.service';

@Module({
  imports: [TripsModule],
  providers: [DiscoverTripsResolver, DiscoverTripsService],
  exports: [DiscoverTripsService],
})
export class DiscoverTripsModule {}
