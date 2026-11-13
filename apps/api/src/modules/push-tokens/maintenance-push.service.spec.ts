import 'reflect-metadata';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenancePushService } from './maintenance-push.service';

// Captures messages handed to Expo + lets each test choose the send outcome.
const mockSentMessages: Array<{ title?: string; body?: string; data?: unknown }> = [];
const mockExpo = {
  sendResult: 'ok' as 'ok' | 'throw' | 'errorTicket' | 'deviceNotRegistered' | 'firstOkRestError',
};
// Records which tables had .delete() called — proves dedup-claim release on failure.
const mockDeletes: string[] = [];

vi.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken = () => true;
    chunkPushNotifications = (m: Array<{ title?: string; body?: string }>) => {
      mockSentMessages.push(...m);
      return m.length ? [m] : [];
    };
    sendPushNotificationsAsync = async (chunk: unknown[]) => {
      if (mockExpo.sendResult === 'throw') throw new Error('expo unreachable');
      if (mockExpo.sendResult === 'errorTicket') {
        return chunk.map(() => ({ status: 'error', details: { error: 'MessageRateExceeded' } }));
      }
      if (mockExpo.sendResult === 'deviceNotRegistered') {
        return chunk.map(() => ({ status: 'error', details: { error: 'DeviceNotRegistered' } }));
      }
      if (mockExpo.sendResult === 'firstOkRestError') {
        // Multi-device: first device accepted, the rest errored.
        return chunk.map((_, i) =>
          i === 0
            ? { status: 'ok', id: 'ticket-x' }
            : { status: 'error', details: { error: 'MessageRateExceeded' } },
        );
      }
      return chunk.map(() => ({ status: 'ok', id: 'ticket-x' }));
    };
  },
}));

/**
 * Minimal chainable Supabase stub: every builder method returns the same object,
 * which is awaited to the table's result. A `table.op` key (`maintenance_push_log.insert`)
 * overrides the table's result for that operation only. Records delete() calls per table.
 */
type StubResult = { data?: unknown; error?: unknown };
function makeAdminClient(resultsByTable: Record<string, StubResult>) {
  const from = vi.fn((table: string) => {
    let op = 'select';
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'delete', 'in', 'is', 'eq', 'gte', 'limit']) {
      builder[m] = vi.fn(() => {
        if (m === 'delete') mockDeletes.push(table);
        if (m === 'insert' || m === 'delete') op = m;
        return builder;
      });
    }
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly, so the mock must resolve on await.
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve(
        resultsByTable[`${table}.${op}`] ?? resultsByTable[table] ?? { data: [], error: null },
      );
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

/** A single due task with one owner who has a registered token; configure locale. */
function clientForLocalizedSend(locale: string | null) {
  return makeAdminClient({
    maintenance_tasks: {
      data: [
        {
          id: 't1',
          user_id: 'u1',
          title: 'Oil change',
          due_date: '2026-07-01',
          motorcycle_id: 'm1',
        },
      ],
      error: null,
    },
    device_push_tokens: { data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }], error: null },
    users: { data: [{ id: 'u1', preferences: locale ? { locale } : {} }], error: null },
    maintenance_push_log: { error: null }, // claim insert succeeds → task is fresh
  });
}

describe('MaintenancePushService.sendDuePush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSentMessages.length = 0;
    mockDeletes.length = 0;
    mockExpo.sendResult = 'ok';
  });

  it('returns a zero summary and sends nothing when no tasks are due', async () => {
    const admin = makeAdminClient({ maintenance_tasks: { data: [], error: null } });
    const summary = await new MaintenancePushService(admin).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 0, pushed: 0, skipped: 0, failed: 0, noToken: 0 });
  });

  it('skips a task whose dedup-log row already exists (unique violation) — idempotent re-run', async () => {
    const admin = makeAdminClient({
      maintenance_tasks: {
        data: [
          {
            id: 't1',
            user_id: 'u1',
            title: 'Oil change',
            due_date: '2026-07-01',
            motorcycle_id: 'm1',
          },
        ],
        error: null,
      },
      device_push_tokens: {
        data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: {} }], error: null },
      'maintenance_push_log.insert': { error: { code: '23505', message: 'duplicate key' } },
    });
    const summary = await new MaintenancePushService(admin).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 1, failed: 0, noToken: 0 });
  });

  it('does not claim a task whose owner has no registered token (no wasted claim)', async () => {
    const admin = makeAdminClient({
      maintenance_tasks: {
        data: [
          {
            id: 't1',
            user_id: 'u1',
            title: 'Oil change',
            due_date: '2026-07-01',
            motorcycle_id: 'm1',
          },
        ],
        error: null,
      },
      device_push_tokens: { data: [], error: null }, // owner has no token
      users: { data: [{ id: 'u1', preferences: {} }], error: null },
    });
    const summary = await new MaintenancePushService(admin).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 0, failed: 0, noToken: 1 });
    expect(mockSentMessages).toHaveLength(0);
  });

  it('localizes the push copy to the owner locale (de)', async () => {
    const summary = await new MaintenancePushService(clientForLocalizedSend('de')).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 1, pushed: 1, skipped: 0, failed: 0, noToken: 0 });
    expect(mockSentMessages[0].title).toBe('Wartung steht an');
    expect(mockSentMessages[0].body).toBe('Oil change ist bald fällig. Zum Ansehen tippen.');
  });

  it('falls back to English when the owner has no/unknown locale', async () => {
    await new MaintenancePushService(clientForLocalizedSend(null)).sendDuePush(1);
    expect(mockSentMessages[0].title).toBe('Maintenance due soon');
    expect(mockSentMessages[0].body).toBe('Oil change is due soon. Tap to review.');
  });

  it('releases the dedup claim when the Expo send fails, so a same-day re-run retries', async () => {
    mockExpo.sendResult = 'throw';
    const summary = await new MaintenancePushService(clientForLocalizedSend('en')).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 0, failed: 1, noToken: 0 });
    // the claim row was deleted so the task is not permanently masked as sent
    expect(mockDeletes).toContain('maintenance_push_log');
  });

  it('prunes a DeviceNotRegistered token and releases that task claim', async () => {
    mockExpo.sendResult = 'deviceNotRegistered';
    const summary = await new MaintenancePushService(clientForLocalizedSend('en')).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 0, failed: 1, noToken: 0 });
    // dead token pruned + dedup claim released
    expect(mockDeletes).toContain('device_push_tokens');
    expect(mockDeletes).toContain('maintenance_push_log');
  });

  it('keeps the claim when at least one of a task’s devices is accepted (no duplicate re-send)', async () => {
    mockExpo.sendResult = 'firstOkRestError';
    const admin = makeAdminClient({
      maintenance_tasks: {
        data: [
          {
            id: 't1',
            user_id: 'u1',
            title: 'Oil change',
            due_date: '2026-07-01',
            motorcycle_id: 'm1',
          },
        ],
        error: null,
      },
      device_push_tokens: {
        data: [
          { user_id: 'u1', token: 'ExponentPushToken[dev1]' },
          { user_id: 'u1', token: 'ExponentPushToken[dev2]' },
        ],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: {} }], error: null },
      maintenance_push_log: { error: null },
    });
    const summary = await new MaintenancePushService(admin).sendDuePush(1);
    // One device accepted → task counts as pushed and the claim is NOT released, so a
    // same-day re-run won't re-push to the device that already got it.
    expect(summary).toEqual({ tasksDue: 1, pushed: 1, skipped: 0, failed: 0, noToken: 0 });
    expect(mockDeletes).not.toContain('maintenance_push_log');
  });

  it('skips (without claiming) on a non-unique dedup-log error', async () => {
    const admin = makeAdminClient({
      maintenance_tasks: {
        data: [
          {
            id: 't1',
            user_id: 'u1',
            title: 'Oil change',
            due_date: '2026-07-01',
            motorcycle_id: 'm1',
          },
        ],
        error: null,
      },
      device_push_tokens: {
        data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: {} }], error: null },
      'maintenance_push_log.insert': { error: { code: '23502', message: 'not-null violation' } },
    });
    const summary = await new MaintenancePushService(admin).sendDuePush(1);
    expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 0, failed: 0, noToken: 0 });
    expect(mockSentMessages).toHaveLength(0);
  });

  it('throws (claiming nothing) when the device-token query errors', async () => {
    const admin = makeAdminClient({
      maintenance_tasks: {
        data: [
          {
            id: 't1',
            user_id: 'u1',
            title: 'Oil change',
            due_date: '2026-07-01',
            motorcycle_id: 'm1',
          },
        ],
        error: null,
      },
      device_push_tokens: { data: null, error: { message: 'timeout', code: '57014' } },
    });
    await expect(new MaintenancePushService(admin).sendDuePush(1)).rejects.toBeTruthy();
    expect(mockDeletes).not.toContain('maintenance_push_log');
  });

  // #365 T07a, D7 reminder cap: at most one push per bike, and none for a bike pushed
  // in the last 7 days. ~10 imported tasks can fall due on the same anniversary.
  describe('per-bike reminder cap (D7)', () => {
    const task = (id: string, motorcycleId: string, title = `Task ${id}`) => ({
      id,
      user_id: 'u1',
      title,
      due_date: '2026-07-01',
      motorcycle_id: motorcycleId,
    });
    const baseTables = (tasks: unknown[], recent: unknown[] = []) => ({
      maintenance_tasks: { data: tasks, error: null },
      device_push_tokens: {
        data: [{ user_id: 'u1', token: 'ExponentPushToken[abc]' }],
        error: null,
      },
      users: { data: [{ id: 'u1', preferences: { locale: 'en' } }], error: null },
      motorcycles: {
        data: [
          { id: 'm1', nickname: null, make: 'Yamaha', model: 'MT-09' },
          { id: 'm2', nickname: 'Blue', make: 'Honda', model: 'CB500F' },
        ],
        error: null,
      },
      'maintenance_push_log.select': { data: recent, error: null },
      'maintenance_push_log.insert': { error: null },
    });

    it('sends ONE push naming the count when 3 tasks are due the same day on one bike', async () => {
      const admin = makeAdminClient(
        baseTables([task('t1', 'm1'), task('t2', 'm1'), task('t3', 'm1')]),
      );
      const summary = await new MaintenancePushService(admin).sendDuePush(1);
      expect(mockSentMessages).toHaveLength(1);
      expect(mockSentMessages[0].body).toBe('3 services due on your MT-09. Tap to review.');
      expect(mockSentMessages[0].data).toMatchObject({ motorcycleId: 'm1', taskCount: 3 });
      // One dedup row per task, so a re-run stays idempotent per task.
      expect(summary).toEqual({ tasksDue: 3, pushed: 3, skipped: 0, failed: 0, noToken: 0 });
    });

    it('keeps the single-task copy when only one task is due on the bike', async () => {
      const admin = makeAdminClient(baseTables([task('t1', 'm1', 'Oil change')]));
      await new MaintenancePushService(admin).sendDuePush(1);
      expect(mockSentMessages).toHaveLength(1);
      expect(mockSentMessages[0].body).toBe('Oil change is due soon. Tap to review.');
    });

    it('skips a bike that already had a maintenance push in the last 7 days', async () => {
      const admin = makeAdminClient(
        baseTables(
          [task('t4', 'm1')],
          [{ task_id: 't-earlier', maintenance_tasks: { motorcycle_id: 'm1' } }],
        ),
      );
      const summary = await new MaintenancePushService(admin).sendDuePush(1);
      expect(mockSentMessages).toHaveLength(0);
      expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 1, failed: 0, noToken: 0 });
    });

    it('sends one push per bike when two bikes have tasks due', async () => {
      const admin = makeAdminClient(
        baseTables([task('t1', 'm1'), task('t2', 'm1'), task('t3', 'm2'), task('t4', 'm2')]),
      );
      await new MaintenancePushService(admin).sendDuePush(1);
      expect(mockSentMessages).toHaveLength(2);
      expect(mockSentMessages.map((m) => m.body).sort()).toEqual([
        '2 services due on your Blue. Tap to review.',
        '2 services due on your MT-09. Tap to review.',
      ]);
    });

    it('a recent push on one bike does not hold back another bike', async () => {
      const admin = makeAdminClient(
        baseTables(
          [task('t1', 'm1'), task('t3', 'm2')],
          [{ task_id: 't-earlier', maintenance_tasks: { motorcycle_id: 'm1' } }],
        ),
      );
      const summary = await new MaintenancePushService(admin).sendDuePush(1);
      expect(mockSentMessages).toHaveLength(1);
      expect(mockSentMessages[0].data).toMatchObject({ motorcycleId: 'm2' });
      expect(summary).toEqual({ tasksDue: 2, pushed: 1, skipped: 1, failed: 0, noToken: 0 });
    });

    it('throws (claiming nothing) when the 7-day lookup errors', async () => {
      const admin = makeAdminClient({
        ...baseTables([task('t1', 'm1')]),
        'maintenance_push_log.select': { data: null, error: { message: 'timeout', code: '57014' } },
      });
      await expect(new MaintenancePushService(admin).sendDuePush(1)).rejects.toBeTruthy();
      expect(mockSentMessages).toHaveLength(0);
    });

    it('releases every task claim of a bike whose combined push failed', async () => {
      mockExpo.sendResult = 'throw';
      const admin = makeAdminClient(baseTables([task('t1', 'm1'), task('t2', 'm1')]));
      const summary = await new MaintenancePushService(admin).sendDuePush(1);
      expect(summary).toEqual({ tasksDue: 2, pushed: 0, skipped: 0, failed: 2, noToken: 0 });
      expect(mockDeletes).toContain('maintenance_push_log');
    });
  });
});
