/**
 * Barrel re-export for sub-services.
 *
 * The monolithic TripsService has been split into focused sub-services under
 * ./services/. This file re-exports them so any existing imports from
 * './trips.service' continue to work (e.g. tests, other modules).
 */
export { TripLifecycleService } from './services/trip-lifecycle.service';
export { TripWaypointsService } from './services/trip-waypoints.service';
export { TripParticipantsService } from './services/trip-participants.service';
export { TripSharingService } from './services/trip-sharing.service';

// Re-export shared helpers/types for consumers that imported them from here
export {
  type TripRow,
  type WaypointRow,
  type ParticipantRow,
  TRIP_SELECT,
  mapRowToTrip,
  mapRowToWaypoint,
  redactOrganiser,
  verifyOrganiser,
} from './services/trip-lifecycle.service';
