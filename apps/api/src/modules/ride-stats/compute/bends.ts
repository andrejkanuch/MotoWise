import {
  angleDiffDeg,
  bearingDeg,
  COMPUTE_CHUNK_POINTS,
  RESAMPLE_SPACING_M,
  type ResampledTrack,
  type YieldFn,
  yieldToEventLoop,
} from './track';

/** Headings are taken over 100 m chords of the resampled track. */
export const BEND_CHORD_M = 100;
/** A bend is at least this much same-direction turning ... */
export const BEND_MIN_TURN_DEG = 35;
/** ... within this distance. */
export const BEND_WINDOW_M = 400;
/** An opposite-direction heading change smaller than this is noise and does not end a turn. */
const TURN_NOISE_DEG = 1;
/** Once counted, a turn must fade below this within the window before the same direction can count again. */
const REARM_TURN_DEG = 10;

/** Road character is judged per 1 km of routed distance. */
const BAND_PIECE_M = 1_000;
/** A last piece shorter than this joins the piece before it. */
const MIN_TAIL_M = BAND_PIECE_M / 2;

/** Upper bounds (exclusive) of bends per km for each band; anything above is `tight`. */
export const BAND_MAX_BENDS_PER_KM = {
  straight: 0.5,
  sweeping: 1.5,
  twisty: 3,
} as const;

export const ROAD_BANDS = ['straight', 'sweeping', 'twisty', 'tight'] as const;
export type RoadBand = (typeof ROAD_BANDS)[number];
export type BandKm = Record<RoadBand, number>;

export interface BendsResult {
  bendsCount: number;
  /** Null when no distance was routable. */
  bendsPerKm: number | null;
  /** Distance that counted: no gap steps, and (with waypoints) no slow steps. */
  routedKm: number;
  /** Routed km in each band; sums to `routedKm`. */
  bandKm: BandKm;
}

const CHORD_STEPS = Math.round(BEND_CHORD_M / RESAMPLE_SPACING_M);
const WINDOW_STEPS = Math.round(BEND_WINDOW_M / RESAMPLE_SPACING_M);

function bandOf(bendsPerKm: number): RoadBand {
  if (bendsPerKm < BAND_MAX_BENDS_PER_KM.straight) return 'straight';
  if (bendsPerKm < BAND_MAX_BENDS_PER_KM.sweeping) return 'sweeping';
  if (bendsPerKm < BAND_MAX_BENDS_PER_KM.twisty) return 'twisty';
  return 'tight';
}

/** Turn accumulator: same-direction heading change over the last 400 m. */
class TurnWindow {
  private sign = 0;
  private window: number[] = [];
  private sum = 0;
  private counted = false;

  reset(): void {
    this.sign = 0;
    this.window = [];
    this.sum = 0;
    this.counted = false;
  }

  feed(deltaDeg: number): boolean {
    if (this.sign === 0) {
      if (Math.abs(deltaDeg) < TURN_NOISE_DEG) return false;
      this.startTurn(deltaDeg);
    } else {
      const along = deltaDeg * this.sign;
      if (along <= -TURN_NOISE_DEG) {
        this.startTurn(deltaDeg);
      } else {
        this.window.push(along);
        this.sum += along;
        if (this.window.length > WINDOW_STEPS) this.sum -= this.window.shift() as number;
      }
    }
    if (this.counted && this.sum < REARM_TURN_DEG) this.counted = false;
    if (!this.counted && this.sum >= BEND_MIN_TURN_DEG) {
      this.counted = true;
      return true;
    }
    return false;
  }

  private startTurn(deltaDeg: number): void {
    this.sign = Math.sign(deltaDeg);
    this.window = [Math.abs(deltaDeg)];
    this.sum = Math.abs(deltaDeg);
    this.counted = false;
  }
}

/**
 * Bends and road-character bands over the 20 m resampled track. Walks the whole
 * track in one pass whose state carries across chunk boundaries, so splitting
 * the work for the event loop never changes the result.
 */
export async function computeBends(
  track: ResampledTrack,
  yieldFn: YieldFn = yieldToEventLoop,
): Promise<BendsResult> {
  const n = track.lat.length;
  const turn = new TurnWindow();
  const bendAtM: number[] = [];
  let routedM = 0;
  let runStart = 0;
  let prevHeading: number | null = null;

  for (let i = 1; i < n; i++) {
    if (i % COMPUTE_CHUNK_POINTS === 0) await yieldFn();
    if (!track.eligible[i]) {
      runStart = i;
      prevHeading = null;
      turn.reset();
      continue;
    }
    routedM += RESAMPLE_SPACING_M;
    const j = i - CHORD_STEPS;
    if (j < runStart) continue;
    const heading = bearingDeg(track.lat[j], track.lng[j], track.lat[i], track.lng[i]);
    if (prevHeading !== null && turn.feed(angleDiffDeg(prevHeading, heading))) {
      bendAtM.push(routedM);
    }
    prevHeading = heading;
  }

  const bandKm: BandKm = { straight: 0, sweeping: 0, twisty: 0, tight: 0 };
  if (routedM === 0) {
    return { bendsCount: 0, bendsPerKm: null, routedKm: 0, bandKm };
  }

  const pieceLengths: number[] = [];
  const fullPieces = Math.floor(routedM / BAND_PIECE_M);
  for (let p = 0; p < fullPieces; p++) pieceLengths.push(BAND_PIECE_M);
  const remainder = routedM - fullPieces * BAND_PIECE_M;
  if (remainder >= MIN_TAIL_M || pieceLengths.length === 0) pieceLengths.push(remainder);
  else pieceLengths[pieceLengths.length - 1] += remainder;

  const bendsPerPiece = new Array<number>(pieceLengths.length).fill(0);
  for (const at of bendAtM) {
    const index = Math.min(Math.floor((at - 1e-6) / BAND_PIECE_M), pieceLengths.length - 1);
    bendsPerPiece[index] += 1;
  }
  pieceLengths.forEach((lengthM, p) => {
    const km = lengthM / 1000;
    bandKm[bandOf(bendsPerPiece[p] / km)] += km;
  });

  const routedKm = routedM / 1000;
  return { bendsCount: bendAtM.length, bendsPerKm: bendAtM.length / routedKm, routedKm, bandKm };
}
