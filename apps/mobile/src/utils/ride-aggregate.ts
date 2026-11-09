import {
  averageMovingSpeedMps,
  computeClimbM,
  computeTrackMovingTimeS,
  type Waypoint,
} from '@motovault/types';
import { haversineMeters } from './geo-utils';

/** Ride totals derived from its recorded waypoints alone. */
export interface WaypointAggregate {
  distanceM: number;
  maxSpeedMps: number;
  /** Distance over moving time; 0 when the ride has no moving time. */
  avgSpeedMps: number;
  /** Moving time from the fixes themselves; null when there are none. */
  movingTimeS: number | null;
  /** Climb with altitude noise filtered out; null when no fix carries an altitude. */
  elevationGain: number | null;
  /** Descent by the same rule as the climb, read backwards. */
  elevationLoss: number | null;
}

/**
 * Totals for a ride from its waypoints, in recording order. One definition for
 * the end-of-ride summary, the EndRide payload and for restoring the live stats
 * after the app was killed mid-ride. Climb and moving time use the same shared
 * metrics as the server, so the summary and the stored ride agree.
 */
export function aggregateWaypoints(points: readonly Waypoint[]): WaypointAggregate {
  let distanceM = 0;
  let maxSpeedMps = 0;

  for (let i = 0; i < points.length; i++) {
    const wp = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      distanceM += haversineMeters(
        { lat: prev.latitude, lng: prev.longitude },
        { lat: wp.latitude, lng: wp.longitude },
      );
    }
    const speed = wp.speedMps ?? 0;
    if (speed > maxSpeedMps) maxSpeedMps = speed;
  }

  const altitudes = points.map((wp) => wp.altitude);
  const movingTimeS = computeTrackMovingTimeS(points);

  return {
    distanceM,
    maxSpeedMps,
    avgSpeedMps: averageMovingSpeedMps(distanceM, movingTimeS) ?? 0,
    movingTimeS,
    elevationGain: computeClimbM(altitudes),
    elevationLoss: computeClimbM([...altitudes].reverse()),
  };
}
