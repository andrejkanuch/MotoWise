import { describe, expect, it } from 'vitest';
import { computeClimbM } from '../climb';
import { altitudeNoise, seededRandom } from './fixtures';

describe('computeClimbM', () => {
  it('gives 0 m on a flat ride with ±3 m of altitude noise', () => {
    const random = seededRandom(7);
    const altitudes = Array.from({ length: 3_000 }, () => 250 + altitudeNoise(random, 3));

    expect(computeClimbM(altitudes)).toBe(0);
  });

  it('gives 0 m on a flat ride whose ±3 m noise includes single-fix spikes, even on the first fix', () => {
    const altitudes = Array.from({ length: 200 }, (_, i) => {
      if (i === 0 || i % 20 === 10) return 247;
      if (i % 20 === 0) return 253;
      return 250;
    });

    expect(computeClimbM(altitudes)).toBe(0);
  });

  it('gives 0 m when altitude swings back and forth by just under 5 m', () => {
    const altitudes = Array.from({ length: 500 }, (_, i) =>
      Math.floor(i / 5) % 2 === 0 ? 250 : 254.9,
    );

    expect(computeClimbM(altitudes)).toBe(0);
  });

  it('gives a 400 m pass within 5% of 400 m, through ±3 m of noise', () => {
    const random = seededRandom(42);
    // 800 fixes up at 0.5 m each, 200 at the top, 800 back down: a 400 m pass.
    const profile = [
      ...Array.from({ length: 800 }, (_, i) => 1_000 + i * 0.5),
      ...Array.from({ length: 200 }, () => 1_400),
      ...Array.from({ length: 800 }, (_, i) => 1_400 - i * 0.5),
    ];
    const altitudes = profile.map((altitude) => altitude + altitudeNoise(random, 3));

    const climb = computeClimbM(altitudes);

    expect(climb).not.toBeNull();
    expect(Math.abs((climb as number) - 400)).toBeLessThanOrEqual(400 * 0.05);
  });

  it('counts a climb separated by a short noisy dip once, not twice', () => {
    // 0 → 50, a 3 m dip, then 47 → 100: 100 m of climb in total.
    const altitudes = [
      ...Array.from({ length: 51 }, (_, i) => i),
      47,
      47,
      47,
      47,
      47,
      ...Array.from({ length: 54 }, (_, i) => 47 + i),
    ];

    const climb = computeClimbM(altitudes) as number;

    expect(climb).toBeGreaterThanOrEqual(95);
    expect(climb).toBeLessThanOrEqual(100);
  });

  it('skips missing altitude readings', () => {
    // A 0 → 100 m ramp in 10 m steps with gaps; the filter's cut-off ends cost one step each.
    const altitudes = [0, null, 10, 20, undefined, 30, 40, 50, null, 60, 70, 80, 90, null, 100];

    expect(computeClimbM(altitudes)).toBe(80);
  });

  it('gives null for empty input or input with no altitude at all', () => {
    expect(computeClimbM([])).toBeNull();
    expect(computeClimbM([null, undefined])).toBeNull();
  });
});
