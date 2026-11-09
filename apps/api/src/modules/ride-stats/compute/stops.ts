import { MOVING_MIN_SPEED_MPS } from '@motovault/types';
import { haversineM, type TrackFix } from './track';

/** A stop is time spent within this radius of where it began ... */
const STOP_RADIUS_M = 50;
/** ... for at least this long (lights and junctions are shorter). */
const STOP_MIN_DURATION_S = 120;

export interface RideStop {
  lat: number;
  lng: number;
  startedAt: string;
  durationS: number;
}

const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

function movingStep(a: TrackFix, b: TrackFix): boolean {
  const dtS = ((b.t as number) - (a.t as number)) / 1000;
  return dtS > 0 && haversineM(a.lat, a.lng, b.lat, b.lng) / dtS >= MOVING_MIN_SPEED_MPS;
}

/**
 * Stops from timed waypoints: a cluster of fixes within 50 m of its first fix,
 * trimmed of the moving steps that enter and leave it, lasting at least 2
 * minutes. A silent gap while parked (the phone stops reporting) counts too,
 * because the fixes either side of it are in the same place.
 */
export function computeStops(fixes: readonly TrackFix[]): RideStop[] {
  const stops: RideStop[] = [];
  if (fixes.some((f) => f.t === null)) return stops;
  let i = 0;
  while (i < fixes.length - 1) {
    const anchor = fixes[i];
    let last = i;
    while (
      last + 1 < fixes.length &&
      haversineM(anchor.lat, anchor.lng, fixes[last + 1].lat, fixes[last + 1].lng) <= STOP_RADIUS_M
    ) {
      last++;
    }
    let first = i;
    while (first < last && movingStep(fixes[first], fixes[first + 1])) first++;
    let end = last;
    while (end > first && movingStep(fixes[end - 1], fixes[end])) end--;
    const durationS = ((fixes[end].t as number) - (fixes[first].t as number)) / 1000;
    if (durationS >= STOP_MIN_DURATION_S) {
      const cluster = fixes.slice(first, end + 1);
      stops.push({
        lat: round5(cluster.reduce((sum, f) => sum + f.lat, 0) / cluster.length),
        lng: round5(cluster.reduce((sum, f) => sum + f.lng, 0) / cluster.length),
        startedAt: new Date(fixes[first].t as number).toISOString(),
        durationS: Math.round(durationS),
      });
      i = end + 1;
    } else {
      i++;
    }
  }
  return stops;
}
