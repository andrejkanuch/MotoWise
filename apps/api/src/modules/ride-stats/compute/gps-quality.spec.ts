import { describe, expect, it } from 'vitest';
import { computeGpsQuality } from './gps-quality';
import type { TrackFix } from './track';

const T0 = Date.parse('2026-06-06T08:00:00Z');
const fix = (s: number, accuracy: number | null): TrackFix => ({
  t: T0 + s * 1000,
  lat: 42.4,
  lng: -2.5 + s * 1e-4,
  alt: null,
  speed: 20,
  heading: null,
  accuracy,
});

describe('computeGpsQuality', () => {
  it('is the share of accurate fixes times the share of time without gaps over 10 s', () => {
    // 0..100 s at 1 s, accuracy 5 m, except 20 fixes at 30 m; then a 50 s gap; then 100 s more.
    const fixes: TrackFix[] = [];
    for (let s = 0; s <= 100; s++) fixes.push(fix(s, s >= 40 && s < 60 ? 30 : 5));
    for (let s = 150; s <= 250; s++) fixes.push(fix(s, 5));
    const result = computeGpsQuality(fixes);
    const accurateShare = (202 - 20) / 202;
    const gapFreeShare = (250 - 50) / 250;
    expect(result?.quality).toBeCloseTo(accurateShare * gapFreeShare, 6);
    expect(result?.metrics).toEqual({
      fixCount: 202,
      accurateShare: expect.closeTo(accurateShare, 6),
      gapFreeShare: expect.closeTo(gapFreeShare, 6),
      maxGapS: 50,
    });
  });

  it('judges accuracy only over fixes that report it', () => {
    const fixes = [fix(0, null), fix(1, 5), fix(2, null), fix(3, 5)];
    expect(computeGpsQuality(fixes)?.quality).toBe(1);
  });

  it('is null without timed fixes or without any accuracy', () => {
    expect(computeGpsQuality([])).toBeNull();
    expect(computeGpsQuality([fix(0, null), fix(1, null)])).toBeNull();
  });
});
