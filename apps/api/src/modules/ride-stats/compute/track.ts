import { DEG, haversineM } from '../../../common/geo';
import { decodePolyline, type LatLng } from '../../../common/polyline';
import type { TrackPointsRow } from '../../../common/track-points';

/** One stored fix (waypoint) or polyline vertex. Polyline vertices carry no time or sensors. */
export interface TrackFix {
  /** Epoch ms; null for polyline vertices. */
  t: number | null;
  lat: number;
  lng: number;
  alt: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
}

/** The whole ride is resampled at this spacing before bends and cells; never downsampled further. */
export const RESAMPLE_SPACING_M = 20;

/** A longer step between two stored fixes is a gap (battery saver, thinning): left out of bends and band shares. */
export const MAX_FIX_GAP_M = 50;

/** With waypoints, steps slower than 25 km/h (junctions, traffic) are left out of bends and band shares. */
export const MIN_ROUTED_SPEED_MPS = 25 / 3.6;

/** Compute stages walk at most this many points before yielding to the event loop. */
export const COMPUTE_CHUNK_POINTS = 5_000;

/** Douglas-Peucker tolerance for the stored route geometry. */
export const ROUTE_SIMPLIFY_TOLERANCE_M = 5;

const METRES_PER_DEG_LAT = 111_320;

export type YieldFn = () => Promise<void>;

export const yieldToEventLoop: YieldFn = () => new Promise((resolve) => setImmediate(resolve));

/** Initial bearing from a to b, degrees clockwise from north in [0, 360). */
export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const y = Math.sin((bLng - aLng) * DEG) * Math.cos(bLat * DEG);
  const x =
    Math.cos(aLat * DEG) * Math.sin(bLat * DEG) -
    Math.sin(aLat * DEG) * Math.cos(bLat * DEG) * Math.cos((bLng - aLng) * DEG);
  return (((Math.atan2(y, x) / DEG) % 360) + 360) % 360;
}

/** Signed smallest difference b - a in degrees, in (-180, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function fixesFromTrackPoints(row: TrackPointsRow): TrackFix[] {
  const fixes: TrackFix[] = [];
  for (let i = 0; i < row.latitude.length; i++) {
    const lat = row.latitude[i];
    const lng = row.longitude[i];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    fixes.push({
      t: Date.parse(row.recorded_at[i]),
      lat,
      lng,
      alt: finiteOrNull(row.altitude[i]),
      speed: finiteOrNull(row.speed_mps[i]),
      heading: finiteOrNull(row.heading[i]),
      accuracy: finiteOrNull(row.accuracy[i]),
    });
  }
  return fixes;
}

export function fixesFromPolyline(encoded: string): TrackFix[] {
  return decodePolyline(encoded).map(({ lat, lng }) => ({
    t: null,
    lat,
    lng,
    alt: null,
    speed: null,
    heading: null,
    accuracy: null,
  }));
}

export function trackDistanceM(fixes: readonly TrackFix[]): number {
  let total = 0;
  for (let i = 1; i < fixes.length; i++) {
    total += haversineM(fixes[i - 1].lat, fixes[i - 1].lng, fixes[i].lat, fixes[i].lng);
  }
  return total;
}

/** Speed over a step between two fixes: their mean reported speed, else distance over time, else unknown. */
export function stepSpeedMps(a: TrackFix, b: TrackFix, lengthM: number): number | null {
  if (a.speed !== null && b.speed !== null) return (a.speed + b.speed) / 2;
  if (a.t !== null && b.t !== null && b.t > a.t) return lengthM / ((b.t - a.t) / 1000);
  return null;
}

/**
 * The ride resampled every 20 m along its fixes. `eligible[i]` says whether the
 * 20 m step that ends at point i may count for road character: it must not
 * cross a stored step longer than 50 m, and (with waypoints) not be slower than
 * 25 km/h. `fixStepM[i]` is the longest stored step that 20 m step crosses.
 */
export interface ResampledTrack {
  lat: number[];
  lng: number[];
  eligible: boolean[];
  fixStepM: number[];
}

export async function resampleTrack(
  fixes: readonly TrackFix[],
  options: { useSpeed: boolean },
  yieldFn: YieldFn = yieldToEventLoop,
): Promise<ResampledTrack> {
  const out: ResampledTrack = { lat: [], lng: [], eligible: [], fixStepM: [] };
  if (fixes.length === 0) return out;

  out.lat.push(fixes[0].lat);
  out.lng.push(fixes[0].lng);
  out.eligible.push(false);
  out.fixStepM.push(0);

  let toNext = RESAMPLE_SPACING_M;
  let stepOk = true;
  let stepMaxFixM = 0;

  for (let k = 0; k + 1 < fixes.length; k++) {
    if (k > 0 && k % COMPUTE_CHUNK_POINTS === 0) await yieldFn();
    const a = fixes[k];
    const b = fixes[k + 1];
    const lengthM = haversineM(a.lat, a.lng, b.lat, b.lng);
    if (lengthM === 0) continue;
    const speed = options.useSpeed ? stepSpeedMps(a, b, lengthM) : null;
    const segmentOk = lengthM <= MAX_FIX_GAP_M && (speed === null || speed >= MIN_ROUTED_SPEED_MPS);
    stepOk = stepOk && segmentOk;
    stepMaxFixM = Math.max(stepMaxFixM, lengthM);

    let consumed = 0;
    while (lengthM - consumed >= toNext) {
      consumed += toNext;
      const f = consumed / lengthM;
      out.lat.push(a.lat + (b.lat - a.lat) * f);
      out.lng.push(a.lng + (b.lng - a.lng) * f);
      out.eligible.push(stepOk);
      out.fixStepM.push(stepMaxFixM);
      toNext = RESAMPLE_SPACING_M;
      stepOk = segmentOk;
      stepMaxFixM = lengthM;
    }
    toNext -= lengthM - consumed;
  }
  return out;
}

/** Douglas-Peucker in a local metre projection, iterative so long rides cannot overflow the stack. */
export function simplifyRoute(
  fixes: readonly TrackFix[],
  toleranceM: number = ROUTE_SIMPLIFY_TOLERANCE_M,
): LatLng[] {
  const n = fixes.length;
  if (n <= 2) return fixes.map(({ lat, lng }) => ({ lat, lng }));
  const lat0 = fixes[0].lat;
  const mPerDegLng = METRES_PER_DEG_LAT * Math.cos(lat0 * DEG);
  const xs = fixes.map((f) => (f.lng - fixes[0].lng) * mPerDegLng);
  const ys = fixes.map((f) => (f.lat - lat0) * METRES_PER_DEG_LAT);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    const dx = xs[last] - xs[first];
    const dy = ys[last] - ys[first];
    const len2 = dx * dx + dy * dy;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      let px = xs[i] - xs[first];
      let py = ys[i] - ys[first];
      if (len2 > 0) {
        const tt = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        px -= tt * dx;
        py -= tt * dy;
      }
      const d = px * px + py * py;
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > toleranceM * toleranceM) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const route: LatLng[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) route.push({ lat: fixes[i].lat, lng: fixes[i].lng });
  return route;
}

/** EWKT for a LineString in WGS 84, the literal PostgREST passes to a `geometry` column or argument. */
export function toEwktLineString(route: readonly LatLng[]): string {
  const coords = route.map(({ lat, lng }) => `${lng.toFixed(6)} ${lat.toFixed(6)}`).join(',');
  return `SRID=4326;LINESTRING(${coords})`;
}
