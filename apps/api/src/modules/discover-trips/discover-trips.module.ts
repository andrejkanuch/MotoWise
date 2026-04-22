import '../../shared/graphql/enums';
import { Module } from '@nestjs/common';
import { DiscoverTripsResolver } from './discover-trips.resolver';
import { DiscoverTripsService } from './discover-trips.service';

@Module({
  providers: [DiscoverTripsResolver, DiscoverTripsService],
})
export class DiscoverTripsModule {}
