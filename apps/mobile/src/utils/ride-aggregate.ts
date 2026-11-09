import type { Waypoint } from '@motovault/types';
import { haversineMeters } from './geo-utils';

/** Ride totals derived from its recorded waypoints alone. */
export interface WaypointAggregate {
  distanceM: number;
  maxSpeedMps: number;
  /** Mean of the non-zero speed samples (standing still does not drag it down). */
  avgSpeedMps: number;
  elevationGain: number;
  elevationLoss: number;
}

/**
 * Totals for a ride from its waypoints, in recording order. One definition for
 * the end-of-ride summary and for restoring the live stats after the app was
 * killed mid-ride — so a resumed ride shows the distance it already covered
 * instead of starting over at 0.
 */
export function aggregateWaypoints(points: readonly Waypoint[]): WaypointAggregate {
  let distanceM = 0;
  let maxSpeedMps = 0;
  let speedSum = 0;
  let speedCount = 0;
  let elevationGain = 0;
  let elevationLoss = 0;

  for (let i = 0; i < points.length; i++) {
    const wp = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      distanceM += haversineMeters(
        { lat: prev.latitude, lng: prev.longitude },
        { lat: wp.latitude, lng: wp.longitude },
      );
      if (prev.altitude != null && wp.altitude != null) {
        const diff = wp.altitude - prev.altitude;
        if (diff > 0) elevationGain += diff;
        else elevationLoss -= diff;
      }
    }
    const speed = wp.speedMps ?? 0;
    if (speed > maxSpeedMps) maxSpeedMps = speed;
    if (speed > 0) {
      speedSum += speed;
      speedCount++;
    }
  }

  return {
    distanceM,
    maxSpeedMps,
    avgSpeedMps: speedCount > 0 ? speedSum / speedCount : 0,
    elevationGain,
    elevationLoss,
  };
}
