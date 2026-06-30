import 'reflect-metadata';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaintenancePushService } from './maintenance-push.service';

// The service constructs `new Expo()`; stub the SDK so the import is side-effect free.
vi.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken = () => true;
    chunkPushNotifications = (m: unknown[]) => (m.length ? [m] : []);
    sendPushNotificationsAsync = async () => [];
  },
}));

/**
 * Minimal chainable Supabase stub: every builder method returns the same object,
 * which is awaited to `result`. Configure one result per table.
 */
function makeAdminClient(resultsByTable: Record<string, { data?: unknown; error?: unknown }>) {
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'delete', 'in', 'is', 'eq']) {
      builder[m] = vi.fn(() => builder);
    }
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly, so the mock must resolve on await.
    builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

describe('MaintenancePushService.sendDuePush', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a zero summary and sends nothing when no tasks are due', async () => {
    const admin = makeAdminClient({ maintenance_tasks: { data: [], error: null } });
    const service = new MaintenancePushService(admin);

    const summary = await service.sendDuePush(1);

    expect(summary).toEqual({ tasksDue: 0, pushed: 0, skipped: 0 });
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
      // dedup insert conflicts → already sent for this (task, due_date)
      maintenance_push_log: { error: { code: '23505', message: 'duplicate key' } },
    });
    const service = new MaintenancePushService(admin);

    const summary = await service.sendDuePush(1);

    expect(summary).toEqual({ tasksDue: 1, pushed: 0, skipped: 1 });
  });
});
