import { describe, expect, it } from 'vitest';
import { encodePolyline } from '../../../common/polyline';
import {
  drive,
  type FixtureFix,
  type Leg,
  mountainLoopLegs,
  RUN_OUT,
  repeat,
  valleyRoadLegs,
} from './__fixtures__/roads';
import { computeBends } from './bends';
import { fixesFromPolyline, resampleTrack, type TrackFix } from './track';

const noYield = async () => {};
const RUN_OUT_M = 200;

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

async function bendsOf(fixes: TrackFix[], useSpeed = true) {
  const track = await resampleTrack(fixes, { useSpeed }, noYield);
  return computeBends(track, noYield);
}

describe('computeBends', () => {
  it('a 48 km valley road gives 2-3 bends per 10 km', async () => {
    const result = await bendsOf(toFixes(drive(valleyRoadLegs(), { jitterM: 2 })));
    const per10km = (result.bendsPerKm ?? 0) * 10;
    expect(per10km).toBeGreaterThanOrEqual(2);
    expect(per10km).toBeLessThanOrEqual(3);
    expect(result.bendsCount).toBe(12);
  });

  it('a mountain loop gives more than 15 bends per 10 km', async () => {
    const result = await bendsOf(toFixes(drive(mountainLoopLegs(), { speedMps: 12, jitterM: 2 })));
    expect((result.bendsPerKm ?? 0) * 10).toBeGreaterThan(15);
    expect(result.bendsCount).toBe(40);
  });

  it('band shares of a valley road are mostly straight, and they sum to the routed distance', async () => {
    const result = await bendsOf(toFixes(drive(valleyRoadLegs())));
    const { straight, sweeping, twisty, tight } = result.bandKm;
    expect(straight + sweeping + twisty + tight).toBeCloseTo(result.routedKm, 1);
    expect(result.routedKm).toBeGreaterThan(47);
    // 12 of the ~48 one-km pieces hold a bend (1 per km: sweeping), the rest none.
    expect(sweeping).toBeCloseTo(12, 0);
    expect(straight).toBeGreaterThan(34);
    expect(twisty + tight).toBe(0);
  });

  it('a city route with waypoints leaves out junction turns taken under 25 km/h', async () => {
    const block: Leg[] = [
      { kind: 'straight', lengthM: 300, speedMps: 13 },
      { kind: 'arc', angleDeg: 90, radiusM: 10, speedMps: 4 },
      { kind: 'straight', lengthM: 300, speedMps: 13 },
      { kind: 'arc', angleDeg: -90, radiusM: 10, speedMps: 4 },
    ];
    const fixes = toFixes(drive([...repeat(block, 8), { ...RUN_OUT, speedMps: 13 }]));
    expect((await bendsOf(fixes, true)).bendsCount).toBe(0);
    // The same geometry with no speed information counts every junction.
    expect((await bendsOf(fixes, false)).bendsCount).toBe(16);
  });

  it('a polyline-only ride still gives bends', async () => {
    const fixture = drive(mountainLoopLegs(), { speedMps: 12 });
    const encoded = encodePolyline(fixture.map((f) => ({ lat: f.latitude, lng: f.longitude })));
    const result = await bendsOf(fixesFromPolyline(encoded), false);
    expect(result.bendsCount).toBe(40);
  });

  it('a 250 km ride of two copies of one 125 km road gives the same bends per 10 km as one copy', async () => {
    const road: Leg[] = repeat(
      [
        { kind: 'straight', lengthM: 1_000 },
        { kind: 'arc', angleDeg: 70, radiusM: 120 },
        { kind: 'straight', lengthM: 600 },
        { kind: 'arc', angleDeg: -45, radiusM: 200 },
        { kind: 'straight', lengthM: 1_200 },
        { kind: 'arc', angleDeg: 120, radiusM: 60 },
        { kind: 'arc', angleDeg: -120, radiusM: 60 },
      ],
      37,
    );
    // The second copy carries on from where the first ends: the same road shape again.
    const oneCopy = toFixes(drive([...road, RUN_OUT]));
    const twoCopies = toFixes(drive([...road, ...road, RUN_OUT]));
    expect(twoCopies.length).toBeGreaterThan(10_000);
    const one = await bendsOf(oneCopy);
    const two = await bendsOf(twoCopies);
    expect(two.bendsCount).toBe(one.bendsCount * 2);
    // Equal but for the 200 m run-out, which each ride has once.
    expect(two.bendsPerKm).toBeCloseTo(one.bendsPerKm ?? 0, 2);
  });

  it('leaves thinned gap segments out of bends and band shares', async () => {
    // Four hours: the first two at 1 s fixes, the last two thinned to one fix every
    // 5 s (100 m apart at 72 km/h). The thinned half has bends too.
    const half = repeat(
      [
        { kind: 'straight', lengthM: 4_000 },
        { kind: 'arc', angleDeg: 60, radiusM: 150 },
        { kind: 'straight', lengthM: 4_000 },
        { kind: 'arc', angleDeg: -60, radiusM: 150 },
      ] as Leg[],
      9,
    );
    const thinned = half.map((leg) => ({ ...leg, intervalS: 5 }));
    const fixes = toFixes(drive([...half, RUN_OUT, ...thinned, RUN_OUT]));
    const result = await bendsOf(fixes);
    const halfKm = (9 * 2 * (4_000 + (60 * Math.PI * 150) / 180) + RUN_OUT_M) / 1000;
    expect(result.routedKm).toBeGreaterThan(halfKm - 1);
    expect(result.routedKm).toBeLessThan(halfKm + 1);
    expect(result.bendsCount).toBe(18);
    const { straight, sweeping, twisty, tight } = result.bandKm;
    expect(straight + sweeping + twisty + tight).toBeCloseTo(result.routedKm, 1);
  });

  it('a route with nothing routable gives null bends per km and empty bands', async () => {
    const result = await bendsOf([]);
    expect(result).toEqual({
      bendsCount: 0,
      bendsPerKm: null,
      routedKm: 0,
      bandKm: { straight: 0, sweeping: 0, twisty: 0, tight: 0 },
    });
  });
});
