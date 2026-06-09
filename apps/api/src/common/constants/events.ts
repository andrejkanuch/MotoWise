/**
 * Application event names. Three modules share `ride.completed`; a typo in any of
 * them silently breaks the pipeline, so the literal lives in exactly one place.
 */
export const RIDE_EVENTS = {
  COMPLETED: 'ride.completed',
} as const;

export interface RideCompletedEvent {
  rideId: string;
  userId: string;
  locale: string;
}
