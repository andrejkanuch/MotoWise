import { type MyRidesQuery, RideStatus } from '@motovault/graphql';
import type { QueryClient } from '@tanstack/react-query';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';
import { MIN_RIDE_DISTANCE_M, MIN_RIDE_ELAPSED_S } from '../../utils/ride-constants';
import { getPointBuffer, getWaypointChunks, rideMMKV } from '../../utils/ride-storage';

/**
 * The minimum-ride guard: the sheet the HUD shows when a ride is ended under the
 * floors (`MIN_RIDE_ELAPSED_S` / `MIN_RIDE_DISTANCE_M`). Its events are
 * `ride_too_short_shown` (or `ride_zero_distance_shown` for a long ride the GPS
 * recorded nothing of), one per `action`, each carrying the same snapshot.
 */

/** Which copy the sheet shows. Issue 365 T31 adds `'teaching'` (Experiment 1 test arm). */
export const RIDE_GUARD_VARIANT = {
  DEFAULT: 'default',
} as const;

export type RideGuardVariant = (typeof RIDE_GUARD_VARIANT)[keyof typeof RIDE_GUARD_VARIANT];

export const RIDE_GUARD_ACTION = {
  SHOWN: 'shown',
  KEEP: 'keep',
  END: 'end',
} as const;

export type RideGuardAction = (typeof RIDE_GUARD_ACTION)[keyof typeof RIDE_GUARD_ACTION];

/** Past this, a ride under the distance floor is not a mis-tap — the GPS recorded
 *  nothing (approximate location, no sky view, a killed background task). Saying
 *  "your ride was very short" to someone who rode for 40 minutes is wrong. */
const NO_GPS_MIN_ELAPSED_S = 120;

export function isNoGpsRide(elapsedS: number): boolean {
  return elapsedS >= NO_GPS_MIN_ELAPSED_S;
}

export function isBelowRideFloors(elapsedS: number, distanceM: number): boolean {
  return elapsedS < MIN_RIDE_ELAPSED_S || distanceM < MIN_RIDE_DISTANCE_M;
}

/** Any location point reached the ride (in the live buffer or flushed to a chunk). */
function rideHasPoints(rideId: string | undefined): boolean {
  if (getPointBuffer().length > 0) return true;
  return rideId != null && getWaypointChunks(rideId).some((chunk) => chunk.length > 0);
}

const KMH_PER_MPS = 3.6;
/** One decimal: tells a standstill (GPS jitter, ~1 km/h) from walking or rolling. */
const MAX_SPEED_KMH_PRECISION = 10;

/** What the sheet was opened with; every guard event for it carries these fields. */
export interface RideGuardSnapshot {
  elapsed_s: number;
  distance_m: number;
  /** At least one location point reached the ride buffer (a fix arrived). */
  gps_fix: boolean;
  max_speed_kmh: number;
  /** The rider already has a saved ride over both floors; `null` when not known. */
  has_real_ride: boolean | null;
  variant: RideGuardVariant;
}

export interface RideGuardInput {
  elapsedS: number;
  distanceM: number;
  maxSpeedMps: number;
  gpsFix: boolean;
  hasRealRide: boolean | null;
}

export function buildRideGuardSnapshot(input: RideGuardInput): RideGuardSnapshot {
  return {
    elapsed_s: input.elapsedS,
    distance_m: Math.round(input.distanceM),
    gps_fix: input.gpsFix,
    max_speed_kmh:
      Math.round(Math.max(0, input.maxSpeedMps) * KMH_PER_MPS * MAX_SPEED_KMH_PRECISION) /
      MAX_SPEED_KMH_PRECISION,
    has_real_ride: input.hasRealRide,
    variant: RIDE_GUARD_VARIANT.DEFAULT,
  };
}

/**
 * Whether ending from this sheet discards the ride ("End without saving") instead
 * of opening its summary: a ride under the 50 m floor, whatever its elapsed time,
 * except the no-GPS branch, which keeps "End Anyway" so a ride the GPS missed can
 * still be saved (issue 365 T09, owner decision D3 as amended 2026-11-12). A ride
 * over 50 m that is only under the time floor is kept as before.
 */
export function guardEndDiscards(snapshot: RideGuardSnapshot): boolean {
  return snapshot.distance_m < MIN_RIDE_DISTANCE_M && !isNoGpsRide(snapshot.elapsed_s);
}

export function trackRideGuard(
  snapshot: RideGuardSnapshot,
  action: RideGuardAction,
  rideId: string | null,
): void {
  trackEvent(
    isNoGpsRide(snapshot.elapsed_s)
      ? AnalyticsEvent.RIDE_ZERO_DISTANCE_SHOWN
      : AnalyticsEvent.RIDE_TOO_SHORT_SHOWN,
    { ride_id: rideId, ...snapshot, action },
  );
}

type RideNode = Pick<
  MyRidesQuery['myRides']['edges'][number]['node'],
  'status' | 'durationS' | 'distanceM'
>;

interface RidesPage {
  myRides: {
    edges: readonly { node: RideNode }[];
    pageInfo: { hasNextPage: boolean };
    totalCount: number;
  };
}

function isRealRide(ride: RideNode): boolean {
  return (
    ride.status === RideStatus.Completed &&
    !isBelowRideFloors(ride.durationS ?? 0, ride.distanceM ?? 0)
  );
}

/**
 * Whether the rider has a saved ride over both floors, from ride pages already
 * fetched (newest first). `true` once any page shows one; `false` only when a page
 * holds the rider's whole history and none qualifies; otherwise `null` (unknown).
 */
export function hasRealRide(pages: readonly (RidesPage | undefined)[]): boolean | null {
  let complete = false;
  for (const page of pages) {
    if (!page) continue;
    if (page.myRides.edges.some(({ node }) => isRealRide(node))) return true;
    if (!page.myRides.pageInfo.hasNextPage) complete = true;
  }
  return complete ? false : null;
}

/** Home's recent rides (`rides.list('home')`, set by Home and the checklist). */
const HOME_RIDES_LIST = 'home';

/** `hasRealRide` over the ride lists the app already caches: Home's and Start Ride's. */
export function cachedHasRealRide(queryClient: QueryClient): boolean | null {
  return hasRealRide([
    queryClient.getQueryData<RidesPage>(queryKeys.rides.list(HOME_RIDES_LIST)),
    queryClient.getQueryData<RidesPage>(queryKeys.rides.summary),
  ]);
}

/**
 * The sheet's snapshot for the ride now recording: distance and top speed from the
 * ride store, a fix if the HUD saw one or any point reached the ride, and the
 * rider's history from the cached ride lists.
 */
export function currentRideGuardSnapshot(
  elapsedS: number,
  hudSawFix: boolean,
  queryClient: QueryClient,
): RideGuardSnapshot {
  const { distance, maxSpeed } = useRideStore.getState();
  return buildRideGuardSnapshot({
    elapsedS,
    distanceM: distance,
    maxSpeedMps: maxSpeed,
    gpsFix: hudSawFix || rideHasPoints(rideMMKV.getCurrentId()),
    hasRealRide: cachedHasRealRide(queryClient),
  });
}
