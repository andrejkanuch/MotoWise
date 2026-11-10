import { RIDE_MILESTONE_PAYWALL } from '../constants/limits';
import { RIDE_STATUS, type RideStatus } from '../validators/ride';

/** The ride fields "qualifying" reads, camelCased from the `rides` row. */
export interface QualifyingRideInput {
  status: RideStatus;
  deletedAt: string | null;
  autoEndedReason: string | null;
  distanceM: number | null;
  startedAt: string | null;
  endedAt: string | null;
  pausedDurationS: number | null;
  autoPausedDurationS: number | null;
}

/** Ended minus started minus manual and auto pauses, in whole seconds, never below 0. */
function rideDurationS(ride: QualifyingRideInput & { startedAt: string; endedAt: string }): number {
  const elapsedS = Math.floor((Date.parse(ride.endedAt) - Date.parse(ride.startedAt)) / 1000);
  return Math.max(0, elapsedS - (ride.pausedDurationS ?? 0) - (ride.autoPausedDurationS ?? 0));
}

/**
 * Whether a ride counts toward ride milestones, records and insights: completed,
 * not deleted, not ended by the server (`auto_ended_reason` null, so rides the
 * app auto-ends still count), at least 1 km, and at least 180 s of duration
 * after pauses. Duration is the timestamp span, not GPS moving time.
 */
export function isQualifyingRide(ride: QualifyingRideInput): boolean {
  if (ride.status !== RIDE_STATUS.COMPLETED) return false;
  if (ride.deletedAt !== null || ride.autoEndedReason !== null) return false;
  if (
    ride.distanceM === null ||
    ride.distanceM < RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_DISTANCE_M
  ) {
    return false;
  }
  if (!ride.startedAt || !ride.endedAt) return false;
  return (
    rideDurationS({ ...ride, startedAt: ride.startedAt, endedAt: ride.endedAt }) >=
    RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_MOVING_S
  );
}
