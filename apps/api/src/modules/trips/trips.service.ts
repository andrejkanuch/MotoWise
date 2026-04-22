/**
 * Barrel re-export for sub-services.
 *
 * The monolithic TripsService has been split into focused sub-services under
 * ./services/. This file re-exports them so any existing imports from
 * './trips.service' continue to work (e.g. tests, other modules).
 */
// Re-export shared helpers/types for consumers that imported them from here
export {
  mapRowToTrip,
  mapRowToWaypoint,
  type ParticipantRow,
  redactOrganiser,
  TRIP_SELECT,
  TripLifecycleService,
  type TripRow,
  verifyOrganiser,
  type WaypointRow,
} from './services/trip-lifecycle.service';
export { TripParticipantsService } from './services/trip-participants.service';
export { TripSharingService } from './services/trip-sharing.service';
export { TripWaypointsService } from './services/trip-waypoints.service';
