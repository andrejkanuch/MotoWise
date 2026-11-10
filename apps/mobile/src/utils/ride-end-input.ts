import type { EndRideInput } from '@motovault/graphql';
import type { RideEndSource, Waypoint } from '@motovault/types';
import { aggregateWaypoints, type WaypointAggregate } from './ride-aggregate';
import { encodePolyline } from './ride-heatmap';

export interface RideEndInputArgs {
  rideId: string;
  /** Epoch ms the ride ended (the last movement for a trimmed or idle end). */
  endedAtMs: number;
  /** Every recorded waypoint of the ride, in order. */
  waypoints: readonly Waypoint[];
  pausedMs: number;
  autoPausedMs: number;
  endSource: RideEndSource;
}

export interface RideEnd {
  input: EndRideInput;
  totals: WaypointAggregate;
}

const positiveOrNull = (value: number): number | null => (value > 0 ? value : null);
const roundedOrNull = (value: number | null): number | null =>
  value == null ? null : Math.round(value);

/**
 * The EndRide payload, built the same way for every end the phone makes: the
 * rider's Stop (phone or CarPlay), an end recovered after a kill, and the
 * headless auto-end. A stat the waypoints cannot tell is sent empty, never 0,
 * so the server keeps whatever it already has. GPS quality is the server's to
 * derive, so the phone does not send one.
 */
export function buildRideEndInput({
  rideId,
  endedAtMs,
  waypoints,
  pausedMs,
  autoPausedMs,
  endSource,
}: RideEndInputArgs): RideEnd {
  const totals = aggregateWaypoints(waypoints);
  const routePolyline =
    waypoints.length >= 2
      ? encodePolyline(waypoints.map((wp) => [wp.latitude, wp.longitude] as [number, number]))
      : null;

  return {
    totals,
    input: {
      rideId,
      endedAt: new Date(endedAtMs).toISOString(),
      distanceM: Math.round(totals.distanceM),
      maxSpeedMps: positiveOrNull(totals.maxSpeedMps),
      avgSpeedMps: positiveOrNull(totals.avgSpeedMps),
      elevationGain: roundedOrNull(totals.elevationGain),
      elevationLoss: roundedOrNull(totals.elevationLoss),
      routePolyline,
      pausedDurationS: Math.round(pausedMs / 1000),
      autoPausedDurationS: Math.round(autoPausedMs / 1000),
      endSource,
    },
  };
}
