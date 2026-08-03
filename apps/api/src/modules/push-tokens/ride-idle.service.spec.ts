import 'reflect-metadata';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_AUTO_END_HOURS, IDLE_NUDGE_HOURS, RideIdleService } from './ride-idle.service';

const mockSentMessages: Array<{ title?: string; body?: string; data?: unknown }> = [];
const mockExpo = { sendResult: 'ok' as 'ok' | 'throw' };
/** Payloads passed to .update(), per table — proves what we write to `rides`. */
const mockUpdates: Array<{ table: string; patch: Record<string, unknown> }> = [];
/** Tables that had .delete() called — proves dedup-claim release. */
const mockDeletes: string[] = [];

vi.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken = () => true;
    chunkPushNotifications = (m: Array<{ title?: string }>) => {
      mockSentMessages.push(...m);
      return m.length ? [m] : [];
    };
    sendPushNotificationsAsync = async (chunk: unknown[]) => {
      if (mockExpo.sendResult === 'throw') throw new Error('expo unreachable');
      return chunk.map(() => ({ status: 'ok', id: 'ticket-x' }));
    };
  },
}));

function makeAdminClient(resultsByTable: Record<string, { data?: unknown; error?: unknown }>) {
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'delete', 'in', 'is', 'eq', 'limit', 'order']) {
      builder[m] = vi.fn(() => {
        if (m === 'delete') mockDeletes.push(table);
        return builder;
      });
    }
    builder.update = vi.fn((patch: Record<string, unknown>) => {
      mockUpdates.push({ table, patch });
      return builder;
    });
    builder.maybeSingle = vi.fn(() => builder);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly.
    builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/**
 * One active ride owned by a user with a registered token.
 * `track` is the ride's waypoint rows (empty = never uploaded any).
 */
function clientFor(opts: {
  startedHoursAgo: number;
  track?: Array<{ recorded_at: string; latitude: number; longitude: number }>;
  logError?: { code?: string } | null;
  hasToken?: boolean;
}) {
  return makeAdminClient({
    rides: {
      data: [
        {
          id: 'r1',
          user_id: 'u1',
          started_at: hoursAgo(opts.startedHoursAgo),
          status: 'recording',
        },
      ],
      error: null,
    },
    ride_waypoints: { data: opts.track ?? [], error: null },
    device_push_tokens: {
      data: opts.hasToken === false ? [] : [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
      error: null,
    },
    users: { data: [{ id: 'u1', preferences: { locale: 'en' } }], error: null },
    ride_idle_nudge_log: { error: opts.logError ?? null },
  });
}

const ridesPatch = () => mockUpdates.find((u) => u.table === 'rides')?.patch;

describe('RideIdleService.sweepIdleRides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSentMessages.length = 0;
    mockUpdates.length = 0;
    mockDeletes.length = 0;
    mockExpo.sendResult = 'ok';
  });

  it('leaves a ride that is still producing GPS completely alone', async () => {
    // A genuine long ride: 14 hours in, but a fix a minute ago. Total duration must
    // never be the trigger — only silence.
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 14,
        track: [{ recorded_at: hoursAgo(0.01), latitude: 34.9, longitude: -82.9 }],
      }),
    );

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ examined: 1, nudged: 0, autoEnded: 0 });
    expect(mockSentMessages).toHaveLength(0);
    expect(ridesPatch()).toBeUndefined();
  });

  it(`nudges (and does not end) a ride idle between ${IDLE_NUDGE_HOURS}h and ${IDLE_AUTO_END_HOURS}h`, async () => {
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 5,
        track: [{ recorded_at: hoursAgo(3), latitude: 34.9, longitude: -82.9 }],
      }),
    );

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ nudged: 1, autoEnded: 0 });
    expect(mockSentMessages).toHaveLength(1);
    expect(mockSentMessages[0].title).toBe('Still riding?');
    // Critically: no write to the ride itself at the nudge stage.
    expect(ridesPatch()).toBeUndefined();
  });

  it('auto-ends a ride idle past the threshold, trimming ended_at back to the last GPS fix', async () => {
    // The regression this guards: completing an abandoned ride with `now()` produced
    // 605-hour rides in production. ended_at must be the last fix, not the sweep time.
    const lastFix = hoursAgo(30);
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 31,
        track: [
          { recorded_at: hoursAgo(31), latitude: 34.9, longitude: -82.9 },
          { recorded_at: lastFix, latitude: 34.91, longitude: -82.91 },
        ],
      }),
    );

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ autoEnded: 1, nudged: 0 });
    const patch = ridesPatch();
    expect(patch).toMatchObject({ status: 'completed', auto_ended_reason: 'idle_timeout' });
    expect(patch?.ended_at).toBe(lastFix);
    // Distance is reconstructed from the track so the saved ride isn't blank.
    expect(patch?.distance_m).toBeGreaterThan(0);
    expect(mockSentMessages[0].title).toBe('Ride saved');
  });

  it('collapses a never-moved ride to zero duration instead of inventing one', async () => {
    // 8 of the 10 real stuck rides had ZERO waypoints. ended_at must fall back to
    // started_at, so an accidental start is saved as a 0-length ride, not a 3-day one.
    const startedAt = hoursAgo(72);
    const client = makeAdminClient({
      rides: {
        data: [{ id: 'r1', user_id: 'u1', started_at: startedAt, status: 'recording' }],
        error: null,
      },
      ride_waypoints: { data: [], error: null },
      device_push_tokens: {
        data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: {} }], error: null },
      ride_idle_nudge_log: { error: null },
    });

    await new RideIdleService(client).sweepIdleRides();

    const patch = ridesPatch();
    expect(patch?.ended_at).toBe(startedAt);
    // No track → no fabricated distance.
    expect(patch?.distance_m).toBeUndefined();
  });

  it('skips a ride already nudged by an earlier run (dedup claim conflict)', async () => {
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 5,
        track: [{ recorded_at: hoursAgo(3), latitude: 34.9, longitude: -82.9 }],
        logError: { code: '23505' }, // unique_violation
      }),
    );

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ nudged: 0, skipped: 1 });
    expect(mockSentMessages).toHaveLength(0);
  });

  it('still applies the auto-end when the rider has no registered device', async () => {
    // The data correction must not depend on being able to notify.
    const service = new RideIdleService({
      ...clientFor({
        startedHoursAgo: 40,
        track: [{ recorded_at: hoursAgo(30), latitude: 34.9, longitude: -82.9 }],
        hasToken: false,
      }),
    } as SupabaseClient);

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ autoEnded: 1, noToken: 1 });
    expect(ridesPatch()).toMatchObject({ auto_ended_reason: 'idle_timeout' });
    expect(mockSentMessages).toHaveLength(0);
  });

  it('releases the nudge claim when the push send fails, so it retries', async () => {
    mockExpo.sendResult = 'throw';
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 5,
        track: [{ recorded_at: hoursAgo(3), latitude: 34.9, longitude: -82.9 }],
      }),
    );

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ failed: 1, nudged: 0 });
    expect(mockDeletes).toContain('ride_idle_nudge_log');
  });

  it('keeps the auto-end claim even when its push fails (the ride is already ended)', async () => {
    mockExpo.sendResult = 'throw';
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 40,
        track: [{ recorded_at: hoursAgo(30), latitude: 34.9, longitude: -82.9 }],
      }),
    );

    const summary = await service.sweepIdleRides();

    // Ended exactly once; re-running must not end it again, so no claim release.
    expect(summary.autoEnded).toBe(1);
    expect(mockDeletes).not.toContain('ride_idle_nudge_log');
  });

  it('returns an empty summary when there are no active rides', async () => {
    const service = new RideIdleService(makeAdminClient({ rides: { data: [], error: null } }));
    await expect(service.sweepIdleRides()).resolves.toMatchObject({
      examined: 0,
      nudged: 0,
      autoEnded: 0,
    });
  });
});
