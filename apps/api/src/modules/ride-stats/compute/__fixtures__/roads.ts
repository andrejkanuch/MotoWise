/**
 * Synthetic, deterministic ride geometry for the ride-stats tests. A road is a
 * list of legs (straights and constant-radius arcs) driven at a set speed and
 * sampled like a phone would record it, so every expected value (bends, lean
 * band, distance) follows from the geometry rather than from the code under test.
 */

export interface FixtureFix {
  recordedAt: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speedMps: number | null;
  heading: number | null;
  accuracy: number | null;
}

export type Leg =
  | { kind: 'straight'; lengthM: number; speedMps?: number; intervalS?: number }
  | {
      kind: 'arc';
      /** Signed: positive turns right (clockwise), negative turns left. */
      angleDeg: number;
      radiusM: number;
      speedMps?: number;
      intervalS?: number;
    };

export interface DriveOptions {
  start?: { lat: number; lng: number };
  startHeadingDeg?: number;
  speedMps?: number;
  /** Seconds between fixes. */
  intervalS?: number;
  startTime?: string;
  /** Altitude in metres as a function of distance travelled. */
  altitudeAt?: (distanceM: number) => number;
  accuracyM?: number;
  /** Deterministic lateral jitter amplitude in metres (GPS noise). */
  jitterM?: number;
}

const METRES_PER_DEG_LAT = 111_320;
const SUB_STEP_M = 1;

/** Deterministic pseudo-random in [-1, 1) (LCG), so fixtures never change. */
function makeNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0x100000000) * 2 - 1;
  };
}

/** Drive the legs and record fixes. */
export function drive(legs: readonly Leg[], options: DriveOptions = {}): FixtureFix[] {
  const start = options.start ?? { lat: 42.4, lng: -2.5 };
  const baseSpeed = options.speedMps ?? 20;
  const baseInterval = options.intervalS ?? 1;
  const t0 = Date.parse(options.startTime ?? '2026-06-06T08:00:00Z');
  const altitudeAt = options.altitudeAt ?? (() => 400);
  const noise = makeNoise(42);
  const metresPerDegLng = METRES_PER_DEG_LAT * Math.cos((start.lat * Math.PI) / 180);

  let x = 0; // east, metres
  let y = 0; // north, metres
  let heading = options.startHeadingDeg ?? 0; // degrees clockwise from north
  let travelled = 0;
  let timeMs = t0;
  let sinceFix = 0;
  const fixes: FixtureFix[] = [];

  const record = (speed: number) => {
    const jitter = (options.jitterM ?? 0) * noise();
    const rad = (heading * Math.PI) / 180;
    // Jitter is applied sideways to the direction of travel.
    const jx = x + jitter * Math.cos(rad);
    const jy = y - jitter * Math.sin(rad);
    fixes.push({
      recordedAt: new Date(timeMs).toISOString(),
      latitude: start.lat + jy / METRES_PER_DEG_LAT,
      longitude: start.lng + jx / metresPerDegLng,
      altitude: altitudeAt(travelled),
      speedMps: speed,
      heading: ((heading % 360) + 360) % 360,
      accuracy: options.accuracyM ?? 5,
    });
  };

  record(legs.length > 0 ? (legs[0].speedMps ?? baseSpeed) : baseSpeed);

  for (const leg of legs) {
    const speed = leg.speedMps ?? baseSpeed;
    const fixEveryM = speed * (leg.intervalS ?? baseInterval);
    const lengthM =
      leg.kind === 'straight'
        ? leg.lengthM
        : (Math.abs(leg.angleDeg) * Math.PI * leg.radiusM) / 180;
    const turnPerM =
      leg.kind === 'straight'
        ? 0
        : leg.angleDeg / ((Math.abs(leg.angleDeg) * Math.PI * leg.radiusM) / 180);
    const steps = Math.round(lengthM / SUB_STEP_M);
    for (let s = 0; s < steps; s++) {
      heading += turnPerM * SUB_STEP_M;
      const rad = (heading * Math.PI) / 180;
      x += Math.sin(rad) * SUB_STEP_M;
      y += Math.cos(rad) * SUB_STEP_M;
      travelled += SUB_STEP_M;
      timeMs += (SUB_STEP_M / speed) * 1000;
      sinceFix += SUB_STEP_M;
      if (sinceFix >= fixEveryM - 1e-9) {
        sinceFix = 0;
        record(speed);
      }
    }
  }
  return fixes;
}

/**
 * A short straight to end a road on: a heading needs 100 m of road after a bend
 * before the whole bend is visible, so a road that ends mid-bend loses it.
 */
export const RUN_OUT: Leg = { kind: 'straight', lengthM: 200 };

/** Repeat a block of legs n times. */
export function repeat(legs: readonly Leg[], times: number): Leg[] {
  return Array.from({ length: times }, () => legs).flat();
}

/**
 * A 48 km valley road: long straights with one 60° bend (alternating sides)
 * every 4 km, 12 bends in all, so 2.5 bends per 10 km.
 */
export function valleyRoadLegs(): Leg[] {
  return [
    ...repeat(
      [
        { kind: 'straight', lengthM: 3_843 },
        { kind: 'arc', angleDeg: 60, radiusM: 150 },
        { kind: 'straight', lengthM: 3_843 },
        { kind: 'arc', angleDeg: -60, radiusM: 150 },
      ],
      6,
    ),
    RUN_OUT,
  ];
}

/**
 * A mountain loop: a 90° hairpin-like bend every 500 m, alternating sides,
 * 40 bends over 20 km, so 20 bends per 10 km.
 */
export function mountainLoopLegs(): Leg[] {
  return [
    ...repeat(
      [
        { kind: 'straight', lengthM: 437 },
        { kind: 'arc', angleDeg: 90, radiusM: 40 },
        { kind: 'straight', lengthM: 437 },
        { kind: 'arc', angleDeg: -90, radiusM: 40 },
      ],
      20,
    ),
    RUN_OUT,
  ];
}
