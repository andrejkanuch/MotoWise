import { RIDE_WAYPOINT_LIMITS } from '@motovault/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock('@sentry/nestjs', () => sentry);

import { fakeAdmin, pointsRow, ride } from './__fixtures__/fake-admin';
import { RIDE_STATS_VERSION } from './compute/compute-ride-stats';
import {
  RIDE_STATS_SKIP_RETRY_MS,
  RIDE_STATS_SWEEP_BATCH_SIZE,
  RideStatsService,
  STALE_COUNT_RPC,
  STALE_RIDES_RPC,
} from './ride-stats.service';

const config = (values: Record<string, string> = {}) => ({ get: (k: string) => values[k] });

function service(admin: ReturnType<typeof fakeAdmin>) {
  return new RideStatsService(admin.client as never, config() as never);
}

describe('RideStatsService.computeRide', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts the ride_tracks and ride_stats rows by ride id', async () => {
    const admin = fakeAdmin({ rides: { r1: ride('r1') }, points: { r1: pointsRow() } });
    expect(await service(admin).computeRide('r1')).toBe('written');
    const tables = admin.upserts.map((u) => [u.table, u.onConflict]);
    expect(tables).toEqual([
      ['ride_tracks', 'ride_id'],
      ['ride_stats', 'ride_id'],
    ]);
    const stats = admin.upserts[1].row;
    expect(stats).toMatchObject({
      ride_id: 'r1',
      stats_version: RIDE_STATS_VERSION,
      input_source: 'waypoints',
    });
    expect(typeof stats.computed_at).toBe('string');
    // The weather step owns its columns; a recompute never writes them.
    expect(stats).not.toHaveProperty('weather');
    expect(stats).not.toHaveProperty('weather_fetched_at');
  });

  it('caps the track read at the per-ride waypoint limit, so a flooded ride cannot exhaust memory', async () => {
    const admin = fakeAdmin({ rides: { r1: ride('r1') }, points: { r1: pointsRow() } });
    await service(admin).computeRide('r1');
    expect(admin.rpcCalls.find((c) => c.name === 'ride_track_points')?.args).toEqual({
      p_ride_id: 'r1',
      p_max_points: RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE,
    });
  });

  it('stamps computed_at and built_at before the reads, so a track change during the compute leaves the ride stale', async () => {
    let bumpedAt = '';
    const admin = fakeAdmin({
      rides: { r1: ride('r1') },
      points: { r1: pointsRow() },
      // A waypoint batch lands right after the track read: rides.track_updated_at moves on.
      afterTrackRead: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        bumpedAt = new Date().toISOString();
      },
    });
    expect(await service(admin).computeRide('r1')).toBe('written');

    const track = admin.upserts.find((u) => u.table === 'ride_tracks')?.row;
    const stats = admin.upserts.find((u) => u.table === 'ride_stats')?.row;
    const bump = Date.parse(bumpedAt);
    // The stale rule is track_updated_at > computed_at: the sweep must pick the ride up again.
    expect(Date.parse(stats?.computed_at as string)).toBeLessThan(bump);
    expect(Date.parse(track?.built_at as string)).toBeLessThan(bump);
    expect(track?.built_at).toBe(stats?.computed_at);
  });

  it('reads the device time zone from ride_private_details by ride id', async () => {
    // The track starts in Spain; the device zone wins over the start point.
    const admin = fakeAdmin({
      rides: { r1: ride('r1', { time_zone: 'America/New_York' }) },
      points: { r1: pointsRow() },
    });
    await service(admin).computeRide('r1');
    expect(admin.client.from).toHaveBeenCalledWith('ride_private_details');
    const stats = admin.upserts.find((u) => u.table === 'ride_stats')?.row;
    expect(stats?.time_zone).toBe('America/New_York');
  });

  it('falls back to the start point zone when the ride has no ride_private_details row', async () => {
    const admin = fakeAdmin({
      rides: { r1: ride('r1', { time_zone: null }) },
      points: { r1: pointsRow() },
    });
    await service(admin).computeRide('r1');
    const stats = admin.upserts.find((u) => u.table === 'ride_stats')?.row;
    expect(stats?.time_zone).toBe('Europe/Madrid');
  });

  it("falls back to the rider's latest device zone from ride_private_details when the ride has neither", async () => {
    const admin = fakeAdmin({
      rides: {
        r1: ride('r1', { time_zone: null, user_id: 'u1', distance_m: 0 }),
        r0: ride('r0', { time_zone: 'Asia/Tokyo', user_id: 'u1' }),
      },
    });
    await service(admin).computeRide('r1');
    const stats = admin.upserts.find((u) => u.table === 'ride_stats')?.row;
    expect(stats?.input_source).toBe('none');
    expect(stats?.time_zone).toBe('Asia/Tokyo');
  });

  it('writes nothing while ref_country_parts is empty, leaving the ride stale', async () => {
    const admin = fakeAdmin({
      rides: { r1: ride('r1') },
      points: { r1: pointsRow() },
      places: { reference_ready: false, countries: [], start_place: null, end_place: null },
    });
    expect(await service(admin).computeRide('r1')).toBe('reference_missing');
    expect(admin.upserts).toEqual([]);
  });

  it('never computes a deleted or unfinished ride', async () => {
    const admin = fakeAdmin({
      rides: {
        gone: ride('gone', { deleted_at: '2026-06-07T00:00:00Z' }),
        live: ride('live', { status: 'recording' }),
      },
    });
    expect(await service(admin).computeRide('gone')).toBe('not_eligible');
    expect(await service(admin).computeRide('live')).toBe('not_eligible');
    expect(admin.upserts).toEqual([]);
  });
});

describe('RideStatsService.sweepStale', () => {
  beforeEach(() => vi.clearAllMocks());

  const staleRow = (id: string, synthetic = false) => ({
    ride_id: id,
    user_id: `user-of-${id}`,
    is_synthetic: synthetic,
    stale_since: '2026-06-06T08:30:00Z',
  });

  it('asks for up to 10 stale rides at the current version', async () => {
    const admin = fakeAdmin({ rides: {} });
    await service(admin).sweepStale();
    expect(RIDE_STATS_SWEEP_BATCH_SIZE).toBe(10);
    expect(admin.rpcCalls.find((c) => c.name === STALE_RIDES_RPC)?.args).toEqual({
      p_stats_version: RIDE_STATS_VERSION,
      p_limit: 10,
      p_exclude: [],
    });
  });

  it('skips a throwing ride, carries on, remembers it, and reports it to Sentry exactly once', async () => {
    const admin = fakeAdmin({
      rides: { a: ride('a'), c: ride('c') },
      stale: [staleRow('a'), staleRow('bad'), staleRow('c')],
      throwFor: ['bad'],
    });
    const svc = service(admin);
    const summary = await svc.sweepStale();

    expect(summary).toMatchObject({
      examined: 3,
      written: 2,
      skipped: ['bad'],
      referenceMissing: 0,
    });
    expect(admin.upserts.filter((u) => u.table === 'ride_stats').map((u) => u.row.ride_id)).toEqual(
      ['a', 'c'],
    );
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).not.toHaveBeenCalled();

    // The next run passes the skip list so the bad ride cannot block the batch.
    await svc.sweepStale();
    const calls = admin.rpcCalls.filter((c) => c.name === STALE_RIDES_RPC);
    expect(calls[1].args.p_exclude).toEqual(['bad']);
  });

  describe('skip window', () => {
    afterEach(() => vi.useRealTimers());

    it('retries a skipped ride once the skip window has passed', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-06-06T10:00:00Z'));
      const admin = fakeAdmin({
        rides: { a: ride('a') },
        stale: [staleRow('bad')],
        throwFor: ['bad'],
      });
      const svc = service(admin);
      await svc.sweepStale();

      vi.setSystemTime(Date.now() + RIDE_STATS_SKIP_RETRY_MS - 1_000);
      await svc.sweepStale();
      vi.setSystemTime(Date.now() + 2_000);
      await svc.sweepStale();

      const excludes = admin.rpcCalls
        .filter((c) => c.name === STALE_RIDES_RPC)
        .map((c) => c.args.p_exclude);
      expect(excludes).toEqual([[], ['bad'], []]);
    });
  });

  it('computes rides in the order the stale-rides RPC returns (real riders first, as its SQL orders them)', async () => {
    const admin = fakeAdmin({
      rides: { s1: ride('s1'), r1: ride('r1'), r2: ride('r2') },
      stale: [staleRow('r1'), staleRow('r2'), staleRow('s1', true)],
    });
    await service(admin).sweepStale();
    expect(admin.upserts.filter((u) => u.table === 'ride_stats').map((u) => u.row.ride_id)).toEqual(
      ['r1', 'r2', 's1'],
    );
  });

  it('reports missing reference data once per run, however many rides it holds back', async () => {
    const admin = fakeAdmin({
      rides: { a: ride('a'), b: ride('b') },
      points: { a: pointsRow(), b: pointsRow() },
      stale: [staleRow('a'), staleRow('b')],
      places: { reference_ready: false, countries: [], start_place: null, end_place: null },
    });
    const summary = await service(admin).sweepStale();
    expect(summary.referenceMissing).toBe(2);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(admin.upserts).toEqual([]);
  });

  it('reports the count of rides stale for over an hour after the run', async () => {
    const admin = fakeAdmin({ rides: {}, staleCount: 7 });
    const before = Date.now();
    const summary = await service(admin).sweepStale();
    expect(summary.staleOverOneHour).toBe(7);
    const countCall = admin.rpcCalls.find((c) => c.name === STALE_COUNT_RPC);
    const olderThan = Date.parse(countCall?.args.p_older_than as string);
    expect(before - olderThan).toBeGreaterThanOrEqual(3_600_000 - 50);
    expect(before - olderThan).toBeLessThan(3_600_000 + 5_000);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage.mock.calls[0][0]).toContain('7');
  });
});
