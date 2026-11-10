import { describe, expect, it } from 'vitest';
import { drive, type FixtureFix, type Leg, RUN_OUT, repeat } from './__fixtures__/roads';
import { computeLeanBands } from './lean';
import type { TrackFix } from './track';

const noYield = async () => {};
const G = 9.80665;

function toFixes(fixture: FixtureFix[]): TrackFix[] {
  return fixture.map((f) => ({
    t: Date.parse(f.recordedAt),
    lat: f.latitude,
    lng: f.longitude,
    alt: f.altitude,
    speed: f.speedMps,
    heading: f.heading,
    accuracy: f.accuracy,
  }));
}

/** Steady-turn lean plus the tyre-width term, worked by hand from the physics. */
function expectedLeanDeg(speedMps: number, radiusM: number, tyreHalfM: number, cogM: number) {
  const phi0 = Math.atan((speedMps * speedMps) / (radiusM * G));
  return ((phi0 + Math.asin((tyreHalfM * Math.sin(phi0)) / (cogM - tyreHalfM))) * 180) / Math.PI;
}

function corners(speedMps: number, radiusM: number, intervalS = 1): Leg[] {
  return [
    ...repeat(
      [
        { kind: 'straight', lengthM: 600 },
        { kind: 'arc', angleDeg: 90, radiusM },
        { kind: 'straight', lengthM: 600 },
        { kind: 'arc', angleDeg: -90, radiusM },
      ],
      5,
    ),
    RUN_OUT,
  ].map((leg) => ({ ...leg, speedMps, intervalS }));
}

describe('computeLeanBands', () => {
  it('puts 100 m radius corners at 72 km/h on a sport bike in the 20-30° band', async () => {
    // atan(20² / (100 g)) = 22.2°, plus the sport-bike tyre term: about 26°.
    const lean = expectedLeanDeg(20, 100, 0.09, 0.6);
    expect(lean).toBeGreaterThan(20);
    expect(lean).toBeLessThan(30);
    const result = await computeLeanBands(toFixes(drive(corners(20, 100))), 'sportbike', noYield);
    expect(result).toEqual({ corners: 10, under20: 0, from20to30: 1, from30to40: 0, from40: 0 });
  });

  it('puts 60 m radius corners at 79 km/h in the 40° and over band', async () => {
    expect(expectedLeanDeg(22, 60, 0.075, 0.58)).toBeGreaterThan(40);
    const result = await computeLeanBands(toFixes(drive(corners(22, 60))), null, noYield);
    expect(result).toEqual({ corners: 10, under20: 0, from20to30: 0, from30to40: 0, from40: 1 });
  });

  it('gives null for a ride sampled every 5 s', async () => {
    const result = await computeLeanBands(
      toFixes(drive(corners(20, 100, 5))),
      'sportbike',
      noYield,
    );
    expect(result).toBeNull();
  });

  it('gives null when under half the moving distance has fixes 1.5 s apart or closer', async () => {
    // 40% of the distance at 1 s fixes, 60% at 3 s fixes.
    const dense = corners(20, 100, 1).slice(0, 8);
    const sparse = corners(20, 100, 3).slice(0, 12);
    const result = await computeLeanBands(toFixes(drive([...dense, ...sparse])), null, noYield);
    expect(result).toBeNull();
  });

  it('counts corners only in the dense part when at least half qualifies', async () => {
    const dense = corners(20, 100, 1).slice(0, 12);
    const sparse = corners(20, 100, 3).slice(0, 8);
    const result = await computeLeanBands(
      toFixes(drive([...dense, ...sparse])),
      'sportbike',
      noYield,
    );
    expect(result?.corners).toBe(6);
  });

  it('gives null for vertices without time (polyline)', async () => {
    const fixes = toFixes(drive(corners(20, 100))).map((f) => ({ ...f, t: null }));
    expect(await computeLeanBands(fixes, null, noYield)).toBeNull();
  });

  it('a straight road gives zero corners rather than null', async () => {
    const fixes = toFixes(drive([{ kind: 'straight', lengthM: 5_000 }]));
    expect(await computeLeanBands(fixes, null, noYield)).toEqual({
      corners: 0,
      under20: 0,
      from20to30: 0,
      from30to40: 0,
      from40: 0,
    });
  });
});
