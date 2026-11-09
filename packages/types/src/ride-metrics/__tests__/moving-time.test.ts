import { describe, expect, it } from 'vitest';
import { averageMovingSpeedMps, computeTrackMovingTimeS } from '../moving-time';
import { fixesAt } from './fixtures';

describe('computeTrackMovingTimeS', () => {
  it('excludes a 20-minute stop from moving time', () => {
    // 10 min riding, 20 min stopped at the roadside, 10 min riding, one fix a second.
    const speeds = [
      ...Array.from({ length: 600 }, () => 15),
      ...Array.from({ length: 1_200 }, () => 0.2),
      ...Array.from({ length: 600 }, () => 15),
    ];

    // The first fix has no interval before it.
    expect(computeTrackMovingTimeS(fixesAt(speeds))).toBe(1_199);
  });

  it('counts a fix exactly at 1.5 m/s as moving and one just under it as stopped', () => {
    expect(computeTrackMovingTimeS(fixesAt([1.5, 1.5, 1.5]))).toBe(2);
    expect(computeTrackMovingTimeS(fixesAt([1.49, 1.49, 1.49]))).toBe(0);
  });

  it('drops an interval longer than 10 s, as a GPS gap, but keeps one of exactly 10 s', () => {
    expect(computeTrackMovingTimeS(fixesAt([20, 20, 20], 10))).toBe(20);
    expect(computeTrackMovingTimeS(fixesAt([20, 20, 20], 11))).toBe(0);
  });

  it('treats a fix with no speed reading as not moving', () => {
    const fixes = fixesAt([20, 20, 20]).map((fix, i) =>
      i === 2 ? { ...fix, speedMps: null } : fix,
    );

    expect(computeTrackMovingTimeS(fixes)).toBe(1);
  });

  it('gives null for empty input', () => {
    expect(computeTrackMovingTimeS([])).toBeNull();
  });
});

describe('averageMovingSpeedMps', () => {
  it('is distance over moving time', () => {
    expect(averageMovingSpeedMps(12_000, 1_200)).toBe(10);
  });

  it('gives null when every sample is under 1.5 m/s', () => {
    const movingTimeS = computeTrackMovingTimeS(fixesAt(Array.from({ length: 300 }, () => 1.2)));

    expect(averageMovingSpeedMps(80, movingTimeS)).toBeNull();
  });

  it('gives null for empty input', () => {
    expect(averageMovingSpeedMps(0, computeTrackMovingTimeS([]))).toBeNull();
    expect(averageMovingSpeedMps(null, null)).toBeNull();
  });
});
