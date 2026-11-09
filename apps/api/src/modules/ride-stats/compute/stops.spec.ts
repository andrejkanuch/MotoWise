import { describe, expect, it } from 'vitest';
import { computeStops } from './stops';
import type { TrackFix } from './track';

const T0 = Date.parse('2026-06-06T08:00:00Z');

function fix(seconds: number, lat: number, lng: number, speed: number): TrackFix {
  return { t: T0 + seconds * 1000, lat, lng, alt: null, speed, heading: null, accuracy: 5 };
}

/** Ride east at 20 m/s (about 0.00024° of longitude per second at 42°N). */
function ride(fromS: number, toS: number, startLng: number): TrackFix[] {
  const out: TrackFix[] = [];
  for (let s = fromS; s <= toS; s++) out.push(fix(s, 42.4, startLng + (s - fromS) * 0.000243, 20));
  return out;
}

describe('computeStops', () => {
  it('finds a 20-minute stop and nothing while moving', () => {
    const first = ride(0, 600, -2.5);
    const stopLng = first[first.length - 1].lng;
    // Parked: a fix every 30 s, wandering a few metres.
    const parked: TrackFix[] = [];
    for (let s = 630; s <= 1800; s += 30)
      parked.push(fix(s, 42.4 + ((s % 60) - 30) * 1e-6, stopLng, 0));
    const second = ride(1830, 2400, stopLng);
    const stops = computeStops([...first, ...parked, ...second]);
    expect(stops).toHaveLength(1);
    expect(stops[0].startedAt).toBe(new Date(T0 + 600_000).toISOString());
    expect(stops[0].durationS).toBeGreaterThanOrEqual(1200);
    expect(stops[0].durationS).toBeLessThanOrEqual(1230);
    expect(stops[0].lat).toBeCloseTo(42.4, 4);
    expect(stops[0].lng).toBeCloseTo(stopLng, 4);
  });

  it('counts a silent gap (no fixes while parked) as a stop', () => {
    const first = ride(0, 300, -2.5);
    const last = first[first.length - 1];
    const resumed = ride(900, 1200, last.lng).map((f, i) =>
      i === 0 ? { ...f, lng: last.lng } : f,
    );
    expect(computeStops([...first, ...resumed])).toHaveLength(1);
  });

  it('ignores a 60-second halt at lights', () => {
    const first = ride(0, 300, -2.5);
    const last = first[first.length - 1];
    const halt = [fix(330, 42.4, last.lng, 0), fix(360, 42.4, last.lng, 0)];
    const second = ride(361, 600, last.lng);
    expect(computeStops([...first, ...halt, ...second])).toEqual([]);
  });
});
