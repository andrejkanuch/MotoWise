import { MOVING_MIN_SPEED_MPS, type MotorcycleType } from '@motovault/types';
import { DEG, haversineM } from '../../../common/geo';
import {
  bearingDeg,
  COMPUTE_CHUNK_POINTS,
  stepSpeedMps,
  type TrackFix,
  type YieldFn,
  yieldToEventLoop,
} from './track';

/**
 * Lean is a GPS-only estimate: the steady-turn lean atan(v·ψ̇/g), from the speed
 * and the turn rate over a short window, plus a tyre-width correction per bike
 * type. Each corner contributes the 90th percentile of its lean, binned into
 * four bands. It is never shown as a single degree value.
 */

const G = 9.80665;
/** Only windows whose fixes are at most this far apart in time are used. */
export const LEAN_MAX_FIX_INTERVAL_MS = 1_500;
/** Turn rate is the slope of the course over a centred window of this half-width ... */
const WINDOW_HALF_MS = 2_000;
/** ... which must span at least this long (3-5 s windows). */
const WINDOW_MIN_SPAN_MS = 3_000;
/** Below this speed the steady-turn model is meaningless (about 29 km/h). */
const LEAN_MIN_SPEED_MPS = 8;
/** A corner is a run of same-sign turning above both of these ... */
const CORNER_MIN_YAW_DEG_S = 4;
const CORNER_MIN_LEAN_DEG = 8;
/** ... lasting at least three fixes over at least this long. */
const CORNER_MIN_FIXES = 3;
const CORNER_MIN_SPAN_MS = 2_000;
/** With less than this share of the moving distance in qualifying windows, lean is not estimated. */
const LEAN_MIN_COVERAGE = 0.5;
const CORNER_PERCENTILE = 0.9;
/** Estimates above this are noise, not riding. */
const LEAN_CAP_DEG = 60;

/** Lower edges (degrees) of the three upper lean bands; below the first is `under20`. */
const LEAN_BAND_EDGES_DEG = { MID: 20, HIGH: 30, EXTREME: 40 } as const;

interface TyreGeometry {
  tyreHalfWidthM: number;
  cogHeightM: number;
}

/** Tyre half-width and combined centre-of-gravity height (m) by bike type. */
export const TYRE_GEOMETRY_BY_BIKE_TYPE: Readonly<Record<MotorcycleType, TyreGeometry>> = {
  sportbike: { tyreHalfWidthM: 0.09, cogHeightM: 0.6 },
  standard: { tyreHalfWidthM: 0.08, cogHeightM: 0.58 },
  touring: { tyreHalfWidthM: 0.09, cogHeightM: 0.62 },
  cruiser: { tyreHalfWidthM: 0.08, cogHeightM: 0.55 },
  dual_sport: { tyreHalfWidthM: 0.075, cogHeightM: 0.65 },
  dirt_bike: { tyreHalfWidthM: 0.06, cogHeightM: 0.65 },
  scooter: { tyreHalfWidthM: 0.06, cogHeightM: 0.5 },
  other: { tyreHalfWidthM: 0.075, cogHeightM: 0.58 },
};

/** Share of corners per band (0-1), plus how many corners the shares are of. */
export interface LeanBands {
  corners: number;
  under20: number;
  from20to30: number;
  from30to40: number;
  from40: number;
}

function tyreGeometry(bikeType: string | null): TyreGeometry {
  return bikeType && bikeType in TYRE_GEOMETRY_BY_BIKE_TYPE
    ? TYRE_GEOMETRY_BY_BIKE_TYPE[bikeType as MotorcycleType]
    : TYRE_GEOMETRY_BY_BIKE_TYPE.other;
}

function withTyreDeg(effectiveDeg: number, tyreHalfWidthM: number, cogHeightM: number): number {
  const phi = Math.abs(effectiveDeg) * DEG;
  const extra = Math.asin((tyreHalfWidthM * Math.sin(phi)) / (cogHeightM - tyreHalfWidthM));
  return (phi + extra) / DEG;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function slope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

interface LeanSample {
  t: number;
  /** Signed turn rate, degrees per second. */
  yawDegS: number;
  /** Signed steady-turn lean, degrees, before the tyre term. */
  effectiveDeg: number;
}

/** Runs of consecutive fixes at most 1.5 s apart, as index ranges [start, end]. */
function denseRuns(fixes: readonly TrackFix[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = 0;
  for (let i = 1; i <= fixes.length; i++) {
    const broken =
      i === fixes.length ||
      (fixes[i].t as number) - (fixes[i - 1].t as number) > LEAN_MAX_FIX_INTERVAL_MS;
    if (broken) {
      if (i - 1 > start) runs.push([start, i - 1]);
      start = i;
    }
  }
  return runs;
}

function samplesForRun(
  fixes: readonly TrackFix[],
  start: number,
  end: number,
): Array<LeanSample | null> {
  // Course at each fix from its neighbours, unwrapped so the regression never sees a 360° jump.
  const course: number[] = [];
  for (let i = start; i <= end; i++) {
    const a = fixes[Math.max(start, i - 1)];
    const b = fixes[Math.min(end, i + 1)];
    let c = bearingDeg(a.lat, a.lng, b.lat, b.lng);
    if (course.length > 0) {
      const prev = course[course.length - 1];
      while (c - prev > 180) c -= 360;
      while (c - prev < -180) c += 360;
    }
    course.push(c);
  }

  // Speed at each fix: its reported speed, else the step between its neighbours.
  const speedAt: Array<number | null> = [];
  for (let k = start; k <= end; k++) {
    const next = fixes[Math.min(end, k + 1)];
    const prev = fixes[Math.max(start, k - 1)];
    speedAt.push(
      fixes[k].speed ??
        stepSpeedMps(prev, next, haversineM(prev.lat, prev.lng, next.lat, next.lng)),
    );
  }

  const samples: Array<LeanSample | null> = [];
  const times: number[] = [];
  const courses: number[] = [];
  const speeds: number[] = [];
  let lo = start;
  let hi = start;
  for (let i = start; i <= end; i++) {
    const t = fixes[i].t as number;
    while ((fixes[lo].t as number) < t - WINDOW_HALF_MS) lo++;
    while (hi < end && (fixes[hi + 1].t as number) <= t + WINDOW_HALF_MS) hi++;
    if ((fixes[hi].t as number) - (fixes[lo].t as number) < WINDOW_MIN_SPAN_MS) {
      samples.push(null);
      continue;
    }
    times.length = 0;
    courses.length = 0;
    speeds.length = 0;
    for (let k = lo; k <= hi; k++) {
      times.push(((fixes[k].t as number) - t) / 1000);
      courses.push(course[k - start]);
      const speed = speedAt[k - start];
      if (speed !== null) speeds.push(speed);
    }
    const v = speeds.length > 0 ? median(speeds) : 0;
    if (v < LEAN_MIN_SPEED_MPS) {
      samples.push(null);
      continue;
    }
    const yawDegS = slope(times, courses);
    const effectiveDeg = Math.atan((v * yawDegS * DEG) / G) / DEG;
    samples.push(Math.abs(effectiveDeg) > LEAN_CAP_DEG ? null : { t, yawDegS, effectiveDeg });
  }
  return samples;
}

/**
 * Lean bands for one ride, from its waypoints. Null when the fixes carry no time
 * (polyline), or when fewer than half of the moving distance lies in steps whose
 * fixes are at most 1.5 s apart (battery saver, thinned long rides).
 */
export async function computeLeanBands(
  fixes: readonly TrackFix[],
  bikeType: string | null,
  yieldFn: YieldFn = yieldToEventLoop,
): Promise<LeanBands | null> {
  if (fixes.length < 2 || fixes.some((f) => f.t === null)) return null;

  let movingM = 0;
  let denseMovingM = 0;
  for (let i = 1; i < fixes.length; i++) {
    const a = fixes[i - 1];
    const b = fixes[i];
    const lengthM = haversineM(a.lat, a.lng, b.lat, b.lng);
    const speed = stepSpeedMps(a, b, lengthM);
    if (speed === null || speed < MOVING_MIN_SPEED_MPS) continue;
    movingM += lengthM;
    if ((b.t as number) - (a.t as number) <= LEAN_MAX_FIX_INTERVAL_MS) denseMovingM += lengthM;
  }
  if (movingM === 0 || denseMovingM < LEAN_MIN_COVERAGE * movingM) return null;

  const { tyreHalfWidthM, cogHeightM } = tyreGeometry(bikeType);
  const cornerLeans: number[] = [];
  let processed = 0;

  for (const [start, end] of denseRuns(fixes)) {
    const samples = samplesForRun(fixes, start, end);
    let corner: LeanSample[] = [];
    const closeCorner = () => {
      const span = corner.length > 0 ? corner[corner.length - 1].t - corner[0].t : 0;
      if (corner.length >= CORNER_MIN_FIXES && span >= CORNER_MIN_SPAN_MS) {
        const leans = corner.map((s) => withTyreDeg(s.effectiveDeg, tyreHalfWidthM, cogHeightM));
        cornerLeans.push(percentile(leans, CORNER_PERCENTILE));
      }
      corner = [];
    };
    for (const sample of samples) {
      processed++;
      if (processed % COMPUTE_CHUNK_POINTS === 0) await yieldFn();
      const inCorner =
        sample !== null &&
        Math.abs(sample.yawDegS) > CORNER_MIN_YAW_DEG_S &&
        Math.abs(sample.effectiveDeg) > CORNER_MIN_LEAN_DEG;
      if (!inCorner) {
        closeCorner();
        continue;
      }
      if (corner.length > 0 && Math.sign(corner[0].yawDegS) !== Math.sign(sample.yawDegS)) {
        closeCorner();
      }
      corner.push(sample);
    }
    closeCorner();
  }

  const n = cornerLeans.length;
  const share = (count: number) => (n === 0 ? 0 : count / n);
  return {
    corners: n,
    under20: share(cornerLeans.filter((l) => l < LEAN_BAND_EDGES_DEG.MID).length),
    from20to30: share(
      cornerLeans.filter((l) => l >= LEAN_BAND_EDGES_DEG.MID && l < LEAN_BAND_EDGES_DEG.HIGH)
        .length,
    ),
    from30to40: share(
      cornerLeans.filter((l) => l >= LEAN_BAND_EDGES_DEG.HIGH && l < LEAN_BAND_EDGES_DEG.EXTREME)
        .length,
    ),
    from40: share(cornerLeans.filter((l) => l >= LEAN_BAND_EDGES_DEG.EXTREME).length),
  };
}
