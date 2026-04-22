import '../../shared/graphql/enums';
import { Module } from '@nestjs/common';
import { TripLifecycleService } from './services/trip-lifecycle.service';
import { TripParticipantsService } from './services/trip-participants.service';
import { TripReviewsService } from './services/trip-reviews.service';
import { TripSavesService } from './services/trip-saves.service';
import { TripSharingService } from './services/trip-sharing.service';
import { TripTemplatesService } from './services/trip-templates.service';
import { TripWaypointsService } from './services/trip-waypoints.service';
import { TripsResolver } from './trips.resolver';

@Module({
  providers: [
    TripsResolver,
    TripLifecycleService,
    TripWaypointsService,
    TripParticipantsService,
    TripSharingService,
    TripTemplatesService,
    TripReviewsService,
    TripSavesService,
  ],
})
export class TripsModule {}
