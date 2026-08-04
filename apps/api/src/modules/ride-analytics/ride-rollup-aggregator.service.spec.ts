import 'reflect-metadata';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RideRecordDetector } from './ride-record-detector.service';
import { RideRollupAggregator } from './ride-rollup-aggregator.service';

const HOUR_MS = 3_600_000;

/** A ride comfortably past the real-ride thresholds so the guard is what decides. */
function rideRow(over: Record<string, unknown> = {}) {
  const started = new Date(Date.now() - 2 * HOUR_MS);
  return {
    id: 'r1',
    user_id: 'u1',
    motorcycle_id: 'm1',
    distance_m: 42_000,
    max_speed_mps: 30,
    avg_speed_mps: 15,
    max_lean_angle: 35,
    elevation_gain: 600,
    elevation_loss: 500,
    started_at: started.toISOString(),
    ended_at: new Date(started.getTime() + HOUR_MS).toISOString(),
    paused_duration_s: 0,
    auto_paused_duration_s: 0,
    metadata: {},
    auto_ended_reason: null,
    ...over,
  };
}

function makeClient(ride: Record<string, unknown>) {
  const rpc = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'update', 'not', 'order', 'limit', 'is']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(async () => ({ data: ride, error: null }));
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase builders are awaited directly.
    builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: ride, error: null });
    return builder;
  });
  return { client: { from, rpc } as unknown as SupabaseClient, rpc };
}

describe('RideRollupAggregator — system-ended rides', () => {
  let detect: ReturnType<typeof vi.fn>;
  let detector: RideRecordDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    detect = vi.fn(async () => undefined);
    detector = { detect } as unknown as RideRecordDetector;
  });

  it('counts a rider-ended ride toward rollups AND records', async () => {
    const { client, rpc } = makeClient(rideRow());
    await new RideRollupAggregator(client, detector).onRideCompleted({
      rideId: 'r1',
      userId: 'u1',
    } as never);

    expect(rpc).toHaveBeenCalledWith('record_ride_analytics', expect.anything());
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('still counts an idle-timeout ride toward rollups — the distance was really ridden', async () => {
    // Excluding it would UNDERSTATE the rider's totals. The sweep trims ended_at to the
    // last GPS fix and reconstructs distance from the track, so the aggregate is honest.
    const { client, rpc } = makeClient(rideRow({ auto_ended_reason: 'idle_timeout' }));
    await new RideRollupAggregator(client, detector).onRideCompleted({
      rideId: 'r1',
      userId: 'u1',
    } as never);

    expect(rpc).toHaveBeenCalledWith('record_ride_analytics', expect.anything());
  });

  it('never lets a system-ended ride set a personal best', async () => {
    // Its GPS track is partial by definition — the sweep only ends rides that STOPPED
    // reporting — so a "longest distance" or "top speed" from it is unverifiable, and a
    // bogus personal record is something the rider cannot undo.
    for (const reason of ['idle_timeout', 'stale_on_start']) {
      detect.mockClear();
      const { client } = makeClient(rideRow({ auto_ended_reason: reason }));
      await new RideRollupAggregator(client, detector).onRideCompleted({
        rideId: 'r1',
        userId: 'u1',
      } as never);

      expect(detect, `${reason} must not reach record detection`).not.toHaveBeenCalled();
    }
  });

  it('does not re-accumulate rollups for a ride already aggregated', async () => {
    // `_upsert_rollup` ADDS to the bucket, so a second run would double-count the
    // distance. `analytics_processed_at` is the only latch preventing that.
    const { client, rpc } = makeClient(
      rideRow({ metadata: { analytics_processed_at: new Date().toISOString() } }),
    );
    await new RideRollupAggregator(client, detector).onRideCompleted({
      rideId: 'r1',
      userId: 'u1',
    } as never);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('still detects records when a rider reclaims a previously auto-ended ride', async () => {
    // The sweep auto-ended this ride (so rollups are already written and latched),
    // then the rider came back and ended it properly — endRide clears
    // auto_ended_reason, and THIS second event is the only chance those records will
    // ever be detected. Hiding record detection behind the rollup latch, as the
    // original single early-return did, made a reclaimed ride permanently unable to
    // set a personal best despite now having a complete track and a real rider end.
    const { client, rpc } = makeClient(
      rideRow({
        auto_ended_reason: null,
        metadata: { analytics_processed_at: new Date().toISOString() },
      }),
    );
    await new RideRollupAggregator(client, detector).onRideCompleted({
      rideId: 'r1',
      userId: 'u1',
    } as never);

    expect(rpc).not.toHaveBeenCalled(); // no double-count
    expect(detect).toHaveBeenCalledTimes(1); // but records still run
  });
});
