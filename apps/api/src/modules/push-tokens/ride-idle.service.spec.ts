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
/** Every .order() call, per table — proves the sweep's queries are deterministic. */
const mockOrders: Array<{ table: string; column: unknown; ascending: unknown }> = [];
/** Every .select() call, per table — proves how much of a track we actually read. */
const mockSelects: Array<{ table: string; columns: unknown }> = [];

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

interface TableResult {
  data?: unknown;
  error?: unknown;
  /**
   * Rows an `.update(...).select()` resolves to, when it must differ from the read
   * result. `[]` models the race the status filter exists for: the rider ended the
   * ride between our read and our write, so the guarded update matches nothing.
   */
  updateData?: unknown;
}

function makeAdminClient(resultsByTable: Record<string, TableResult>) {
  const from = vi.fn((table: string) => {
    const result: TableResult = resultsByTable[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    let isUpdate = false;
    for (const m of ['select', 'insert', 'delete', 'in', 'is', 'eq', 'limit', 'order']) {
      builder[m] = vi.fn((...args: unknown[]) => {
        if (m === 'delete') mockDeletes.push(table);
        if (m === 'select') mockSelects.push({ table, columns: args[0] });
        if (m === 'order') {
          mockOrders.push({
            table,
            column: args[0],
            ascending: (args[1] as { ascending?: boolean } | undefined)?.ascending,
          });
        }
        return builder;
      });
    }
    builder.update = vi.fn((patch: Record<string, unknown>) => {
      mockUpdates.push({ table, patch });
      isUpdate = true;
      return builder;
    });
    // `.maybeSingle()` resolves ONE row, not the array — the newest, since every
    // caller pairs it with `.order(..., { ascending: false }).limit(1)` and this
    // harness stores tracks oldest-first.
    builder.maybeSingle = vi.fn(() => ({
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly.
      then: (resolve: (v: unknown) => unknown) =>
        resolve({
          data: Array.isArray(result.data) ? (result.data.at(-1) ?? null) : (result.data ?? null),
          error: result.error ?? null,
        }),
    }));
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly.
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve(
        isUpdate && result.updateData !== undefined
          ? { data: result.updateData, error: result.error ?? null }
          : result,
      );
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
    mockOrders.length = 0;
    mockSelects.length = 0;
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

  it('does not count an auto-end (or push one) when the rider ended the ride first', async () => {
    // The `.in('status', ACTIVE)` filter is the race guard, and a filter matching zero
    // rows is not a Postgres error. Without observing the returned rows, the sweep
    // counted an end that never happened and pushed "Ride saved — we stopped your ride
    // where the GPS did" to a rider who had just stopped it themselves.
    const client = makeAdminClient({
      rides: {
        data: [{ id: 'r1', user_id: 'u1', started_at: hoursAgo(40), status: 'recording' }],
        updateData: [], // guarded update matched nothing
        error: null,
      },
      ride_waypoints: {
        data: [{ recorded_at: hoursAgo(30), latitude: 34.9, longitude: -82.9 }],
        error: null,
      },
      device_push_tokens: {
        data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: { locale: 'en' } }], error: null },
      ride_idle_nudge_log: { error: null },
    });

    const summary = await new RideIdleService(client).sweepIdleRides();

    expect(summary).toMatchObject({ examined: 1, autoEnded: 0, nudged: 0 });
    expect(mockSentMessages).toHaveLength(0);
    // No auto_end claim written either — a claim would block a legitimate future end.
    expect(mockDeletes).not.toContain('ride_idle_nudge_log');
  });

  it('classifies a healthy ride from one row, never its whole track', async () => {
    // Classification runs per active ride every hour and needs exactly one value —
    // the newest recorded_at. Reading each full track here would move hundreds of
    // thousands of waypoint rows hourly for rides that are perfectly fine. Only rides
    // being ended pull the full track (to rebuild distance_m).
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 14,
        track: [{ recorded_at: hoursAgo(0.01), latitude: 34.9, longitude: -82.9 }],
      }),
    );

    const summary = await service.sweepIdleRides();

    expect(summary).toMatchObject({ examined: 1, nudged: 0, autoEnded: 0 });
    const waypointSelects = mockSelects.filter((s) => s.table === 'ride_waypoints');
    expect(waypointSelects).toEqual([{ table: 'ride_waypoints', columns: 'recorded_at' }]);
  });

  it('reads the full track only for a ride it is actually ending', async () => {
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 40,
        track: [{ recorded_at: hoursAgo(30), latitude: 34.9, longitude: -82.9 }],
      }),
    );

    await service.sweepIdleRides();

    expect(mockSelects.filter((s) => s.table === 'ride_waypoints').map((s) => s.columns)).toEqual([
      'recorded_at', // classification probe
      'recorded_at, latitude, longitude', // distance reconstruction
    ]);
  });

  it('skips a ride whose last-fix probe fails instead of ending it', async () => {
    // Fail-CLOSED is the whole point. Collapsing a read error into "no fixes ever"
    // makes the sweep classify on started_at, so ANY ride older than 24h gets
    // auto-ended on a statement timeout — including one reporting GPS seconds ago —
    // and ended_at is then trimmed to started_at, writing a live 60km ride as a
    // zero-second one. Unknown idle time is not evidence of silence.
    const client = makeAdminClient({
      rides: {
        data: [{ id: 'r1', user_id: 'u1', started_at: hoursAgo(40), status: 'recording' }],
        error: null,
      },
      ride_waypoints: { data: null, error: { message: 'canceling statement due to timeout' } },
      device_push_tokens: {
        data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: { locale: 'en' } }], error: null },
      ride_idle_nudge_log: { error: null },
    });

    const summary = await new RideIdleService(client).sweepIdleRides();

    expect(summary).toMatchObject({ examined: 1, autoEnded: 0, nudged: 0 });
    expect(ridesPatch()).toBeUndefined();
    expect(mockSentMessages).toHaveLength(0);
  });

  it('trims ended_at to the track’s newest fix, not the probe value', async () => {
    // endIdleRide loads the full track anyway, so it is the more complete source for
    // the value ended_at is trimmed to.
    const newest = hoursAgo(25);
    const service = new RideIdleService(
      clientFor({
        startedHoursAgo: 50,
        track: [
          { recorded_at: hoursAgo(48), latitude: 34.9, longitude: -82.9 },
          { recorded_at: newest, latitude: 34.95, longitude: -82.95 },
        ],
      }),
    );

    await service.sweepIdleRides();

    expect(ridesPatch()?.ended_at).toBe(newest);
  });

  it('orders the capped ride query oldest-first so old idle rides cannot starve', async () => {
    // With no ORDER BY, Postgres may return the same arbitrary subset every run, so
    // past the MAX_RIDES_PER_RUN cap the oldest idle rides never get picked up.
    await new RideIdleService(
      makeAdminClient({ rides: { data: [], error: null } }),
    ).sweepIdleRides();

    expect(mockOrders).toContainEqual({
      table: 'rides',
      column: 'started_at',
      ascending: true,
    });
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
