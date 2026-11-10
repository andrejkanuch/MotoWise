import { describe, expect, it, vi } from 'vitest';
import { encodePolyline } from '../../../common/polyline';
import type { TrackPointsRow } from '../../../common/track-points';
import type { RideForStats } from '../ride-stats.types';
import { drive, type FixtureFix, mountainLoopLegs } from './__fixtures__/roads';
import { computeRideStats, RIDE_STATS_VERSION } from './compute-ride-stats';
import { REFERENCE_MISSING } from './places';

const noYield = async () => {};
const SPAIN = { countries: ['ES'], startRegion: 'ES.27', startPlace: 'Logroño', endPlace: 'Haro' };

function ride(overrides: Partial<RideForStats> = {}): RideForStats {
  return {
    id: 'ride-1',
    user_id: 'user-1',
    motorcycle_id: 'bike-1',
    status: 'completed',
    deleted_at: null,
    started_at: '2026-06-06T08:00:00Z',
    ended_at: '2026-06-06T08:40:00Z',
    distance_m: 20_100,
    route_polyline: null,
    time_zone: 'Europe/Madrid',
    ...overrides,
  };
}

function pointsRow(fixtures: FixtureFix[], total = fixtures.length): TrackPointsRow {
  return {
    total_points: total,
    recorded_at: fixtures.map((f) => f.recordedAt),
    latitude: fixtures.map((f) => f.latitude),
    longitude: fixtures.map((f) => f.longitude),
    altitude: fixtures.map((f) => f.altitude),
    speed_mps: fixtures.map((f) => f.speedMps),
    heading: fixtures.map((f) => f.heading),
    accuracy: fixtures.map((f) => f.accuracy),
  };
}

/** A mountain loop climbing 400 m over its 20 km, at 12 m/s with 1 s fixes. */
function mountainFixtures() {
  return drive(mountainLoopLegs(), {
    speedMps: 12,
    jitterM: 2,
    altitudeAt: (d) => 400 + Math.min(400, d / 50),
  });
}

function deps(
  places: Awaited<ReturnType<Parameters<typeof computeRideStats>[1]['lookupPlaces']>> = SPAIN,
) {
  return {
    lookupPlaces: vi.fn().mockResolvedValue(places),
    riderZone: vi.fn().mockResolvedValue(null),
    yieldFn: noYield,
  };
}

describe('computeRideStats', () => {
  it('an app-auto-ended ride with waypoints gets max speed, climb and GPS quality (AE6)', async () => {
    const outcome = await computeRideStats(
      { ride: ride(), trackPoints: pointsRow(mountainFixtures()), bikeType: 'sportbike' },
      deps(),
    );
    if (outcome.kind !== 'row') throw new Error('expected a row');
    const s = outcome.stats;
    expect(s.input_source).toBe('waypoints');
    expect(s.stats_version).toBe(RIDE_STATS_VERSION);
    expect(s.max_speed_mps).toBeCloseTo(12, 5);
    expect(s.climb_m).toBeGreaterThan(380);
    expect(s.climb_m).toBeLessThanOrEqual(400);
    expect(s.gps_quality).toBe(1);
    expect(s.moving_time_s).toBeGreaterThan(1600);
    // distance from the rides row over moving time (rounded to whole seconds when stored)
    expect(s.avg_moving_speed_mps).toBeCloseTo(20_100 / (s.moving_time_s as number), 2);
    expect(s.bends_count).toBe(40);
    expect(s.lean_bands).not.toBeNull();
    expect(s.countries).toEqual(['ES']);
    expect(s.start_region).toBe('ES.27');
    expect(s.cells?.length).toBeGreaterThan(10);
    expect(s.distance_m).toBe(20_100);
    expect(s.elapsed_s).toBe(2_400);
    expect(outcome.track?.source).toBe('waypoints');
    expect(outcome.track?.route.startsWith('SRID=4326;LINESTRING(')).toBe(true);
  });

  it('a polyline-only ride gets geometry stats and null moving time and lean', async () => {
    const encoded = encodePolyline(
      mountainFixtures().map((f) => ({ lat: f.latitude, lng: f.longitude })),
    );
    const outcome = await computeRideStats(
      { ride: ride({ route_polyline: encoded }), trackPoints: null, bikeType: null },
      deps(),
    );
    if (outcome.kind !== 'row') throw new Error('expected a row');
    const s = outcome.stats;
    expect(s.input_source).toBe('polyline');
    expect(s.bends_count).toBe(40);
    expect(s.cells?.length).toBeGreaterThan(10);
    expect(s.countries).toEqual(['ES']);
    expect(s.moving_time_s).toBeNull();
    expect(s.avg_moving_speed_mps).toBeNull();
    expect(s.lean_bands).toBeNull();
    expect(s.stops).toBeNull();
    expect(s.gps_quality).toBeNull();
    expect(outcome.track?.source).toBe('polyline');
  });

  it("a ride with no geometry gets an input_source='none' row with distance from rides", async () => {
    const d = deps();
    const outcome = await computeRideStats(
      { ride: ride({ distance_m: 7_300 }), trackPoints: null, bikeType: null },
      d,
    );
    if (outcome.kind !== 'row') throw new Error('expected a row');
    expect(outcome.stats).toMatchObject({
      input_source: 'none',
      distance_m: 7_300,
      elapsed_s: 2_400,
      bends_count: null,
      cells: null,
      countries: null,
      moving_time_s: null,
      local_date: '2026-06-06',
      local_start_hour: 10,
      local_dow: 6,
    });
    expect(outcome.track).toBeNull();
    expect(d.lookupPlaces).not.toHaveBeenCalled();
  });

  it('leaves the ride stale (no row) while the reference data is missing', async () => {
    const outcome = await computeRideStats(
      { ride: ride(), trackPoints: pointsRow(mountainFixtures()), bikeType: null },
      deps(REFERENCE_MISSING),
    );
    expect(outcome).toEqual({ kind: 'reference_missing' });
  });

  it('recomputing gives an identical row', async () => {
    const input = { ride: ride(), trackPoints: pointsRow(mountainFixtures()), bikeType: 'touring' };
    const first = await computeRideStats(input, deps());
    const second = await computeRideStats(input, deps());
    expect(second).toEqual(first);
  });

  it('an invalid stored time zone falls back to the start point', async () => {
    const fixtures = drive([{ kind: 'straight', lengthM: 3_000 }], {
      start: { lat: 40.4168, lng: -3.7038 },
    });
    const outcome = await computeRideStats(
      { ride: ride({ time_zone: 'GMT+1' }), trackPoints: pointsRow(fixtures), bikeType: null },
      deps(),
    );
    if (outcome.kind !== 'row') throw new Error('expected a row');
    expect(outcome.stats.time_zone).toBe('Europe/Madrid');
    expect(outcome.stats.local_start_hour).toBe(10);
  });

  it('marks a ride at the stored waypoint cap as truncated', async () => {
    const outcome = await computeRideStats(
      { ride: ride(), trackPoints: pointsRow(mountainFixtures(), 10_000), bikeType: null },
      deps(),
    );
    if (outcome.kind !== 'row') throw new Error('expected a row');
    expect(outcome.stats.wp_count).toBe(10_000);
    expect(outcome.stats.wp_truncated).toBe(true);
  });
});
