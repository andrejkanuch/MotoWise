/** Deterministic pseudo-random numbers in [0, 1), so noisy fixtures never flake. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * GPS-like altitude jitter: Gaussian with a 1 m standard deviation, clipped to
 * ±`bound` metres.
 */
export function altitudeNoise(random: () => number, bound: number): number {
  // Box-Muller; 1 - random() keeps the log argument above 0.
  const gaussian = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  return Math.max(-bound, Math.min(bound, gaussian));
}

const START_MS = Date.parse('2026-10-10T10:00:00Z');

/** One fix every `stepS` seconds at the given speeds. */
export function fixesAt(speedsMps: readonly number[], stepS = 1) {
  return speedsMps.map((speedMps, i) => ({
    recordedAt: new Date(START_MS + i * stepS * 1000).toISOString(),
    speedMps,
  }));
}
