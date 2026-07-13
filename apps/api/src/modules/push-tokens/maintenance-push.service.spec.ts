import 'reflect-metadata';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenancePushService } from './maintenance-push.service';

// Captures messages handed to Expo + lets each test choose the send outcome.
const mockSentMessages: Array<{ title?: string; body?: string }> = [];
const mockExpo = { sendResult: 'ok' as 'ok' | 'throw' | 'errorTicket' | 'deviceNotRegistered' };
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
      return chunk.map(() => ({ status: 'ok', id: 'ticket-x' }));
    };
  },
}));

/**
 * Minimal chainable Supabase stub: every builder method returns the same object,
 * which is awaited to `result`. Records delete() calls per table.
 */
function makeAdminClient(resultsByTable: Record<string, { data?: unknown; error?: unknown }>) {
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'delete', 'in', 'is', 'eq']) {
      builder[m] = vi.fn(() => {
        if (m === 'delete') mockDeletes.push(table);
        return builder;
      });
    }
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly, so the mock must resolve on await.
    builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
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
      maintenance_push_log: { error: { code: '23505', message: 'duplicate key' } },
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
      maintenance_push_log: { error: { code: '23502', message: 'not-null violation' } },
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
});
