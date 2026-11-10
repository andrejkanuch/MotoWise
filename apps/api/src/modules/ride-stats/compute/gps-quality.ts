import type { TrackFix } from './track';

/** A fix this accurate or better counts as good. */
const ACCURATE_FIX_M = 20;
/** Time between fixes beyond this is a gap. */
const GAP_S = 10;

export interface GpsQuality {
  /** accurateShare × gapFreeShare, 0-1. */
  quality: number;
  metrics: {
    fixCount: number;
    accurateShare: number;
    gapFreeShare: number;
    maxGapS: number;
  };
}

/**
 * GPS quality: the share of fixes with accuracy within 20 m (over fixes that
 * report accuracy) times the share of the ride's time not spent in gaps over
 * 10 s. Null without timed fixes or without any accuracy reading.
 */
export function computeGpsQuality(fixes: readonly TrackFix[]): GpsQuality | null {
  if (fixes.length < 2 || fixes.some((f) => f.t === null)) return null;
  const withAccuracy = fixes.filter((f) => f.accuracy !== null);
  if (withAccuracy.length === 0) return null;

  const accurateShare =
    withAccuracy.filter((f) => (f.accuracy as number) <= ACCURATE_FIX_M).length /
    withAccuracy.length;

  const spanS = ((fixes[fixes.length - 1].t as number) - (fixes[0].t as number)) / 1000;
  let gapS = 0;
  let maxGapS = 0;
  for (let i = 1; i < fixes.length; i++) {
    const dtS = ((fixes[i].t as number) - (fixes[i - 1].t as number)) / 1000;
    maxGapS = Math.max(maxGapS, dtS);
    if (dtS > GAP_S) gapS += dtS;
  }
  const gapFreeShare = spanS > 0 ? (spanS - gapS) / spanS : 0;

  return {
    quality: accurateShare * gapFreeShare,
    metrics: { fixCount: fixes.length, accurateShare, gapFreeShare, maxGapS },
  };
}
