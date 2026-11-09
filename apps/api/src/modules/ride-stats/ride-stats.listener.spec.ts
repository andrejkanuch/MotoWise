import 'reflect-metadata';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RIDE_EVENTS, type RideCompletedEvent } from '../../common/constants/events';
import { fakeAdmin, pointsRow, ride } from './__fixtures__/fake-admin';
import { type Leg, RUN_OUT, repeat } from './compute/__fixtures__/roads';
import { RIDE_STATS_VERSION } from './compute/compute-ride-stats';
import { RideStatsListener } from './ride-stats.listener';
import { RideStatsService } from './ride-stats.service';

/** Two hours at 17 m/s with 1 s fixes: about 7,200 fixes over 122 km of mixed road. */
function twoHourLegs(): Leg[] {
  return [
    ...repeat(
      [
        { kind: 'straight', lengthM: 1_500 },
        { kind: 'arc', angleDeg: 60, radiusM: 150 },
        { kind: 'straight', lengthM: 800 },
        { kind: 'arc', angleDeg: -90, radiusM: 60 },
        { kind: 'arc', angleDeg: 90, radiusM: 60 },
      ],
      46,
    ),
    RUN_OUT,
  ];
}

/**
 * The real event wiring (EventEmitterModule discovers the @OnEvent handler), with
 * instances built by hand: Vitest's transform emits no decorator metadata, so
 * Nest cannot inject by class type here.
 */
async function boot(admin: ReturnType<typeof fakeAdmin>) {
  const service = new RideStatsService(admin.client as never, { get: () => undefined } as never);
  const moduleRef = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot()],
    providers: [
      { provide: RideStatsService, useValue: service },
      { provide: RideStatsListener, useValue: new RideStatsListener(service) },
    ],
  }).compile();
  await moduleRef.init();
  return moduleRef;
}

async function waitFor(check: () => boolean, timeoutMs: number) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('RideStatsListener', () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it('a COMPLETED event for a 2-hour ride leaves a current ride_stats row within 2 s, never blocking the event loop for 100 ms', async () => {
    const points = pointsRow(twoHourLegs(), 17);
    expect(points.total_points).toBeGreaterThan(7_000);
    const admin = fakeAdmin({
      rides: { long: ride('long', { ended_at: '2026-06-06T10:00:00Z', distance_m: 121_700 }) },
      points: { long: points },
    });
    const moduleRef = await boot(admin);
    close = () => moduleRef.close();

    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();
    const started = performance.now();
    const event: RideCompletedEvent = { rideId: 'long', userId: 'user-of-long', locale: 'en' };
    moduleRef.get(EventEmitter2).emit(RIDE_EVENTS.COMPLETED, event);
    await waitFor(() => admin.upserts.some((u) => u.table === 'ride_stats'), 2_000);
    const elapsedMs = performance.now() - started;
    histogram.disable();

    const row = admin.upserts.find((u) => u.table === 'ride_stats')?.row;
    expect(row).toMatchObject({ ride_id: 'long', stats_version: RIDE_STATS_VERSION });
    expect(row?.bends_count).toBeGreaterThan(100);
    expect(elapsedMs).toBeLessThan(2_000);
    expect(histogram.max / 1e6).toBeLessThan(100);
  });

  it('a failing compute is logged, not thrown into the emitter', async () => {
    const admin = fakeAdmin({ rides: {}, throwFor: ['bad'] });
    const moduleRef = await boot(admin);
    close = () => moduleRef.close();
    const listener = moduleRef.get(RideStatsListener);
    const spy = vi.spyOn(moduleRef.get(RideStatsService), 'computeRide');
    await expect(
      listener.onRideCompleted({ rideId: 'bad', userId: 'u', locale: 'en' }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith('bad');
  });
});
