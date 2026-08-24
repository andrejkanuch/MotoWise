import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANONYMOUS_DISTINCT_ID,
  MAX_SIGNUPS_PER_RUN,
  SIGNUP_EVENT,
  SignupEventsService,
} from '../signup-events.service';

interface PendingRow {
  user_id: string;
  created_at: string;
  auth_method: string | null;
  analytics_enabled: boolean | null;
  currency: string | null;
  measurement_system: string | null;
}

const row = (over: Partial<PendingRow> = {}): PendingRow => ({
  user_id: '11111111-1111-1111-1111-111111111111',
  created_at: '2026-09-03T09:58:00.000Z',
  auth_method: 'email',
  analytics_enabled: true,
  currency: 'EUR',
  measurement_system: 'metric',
  ...over,
});

/** Minimal ConfigService stand-in. */
const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as never;

function makeSupabase(handlers: Record<string, (args: unknown) => unknown>) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      if (!handler) return { data: null, error: { message: `no handler for ${fn}` } };
      return handler(args);
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

/** Captures what would be POSTed to PostHog. */
function stubFetch(response: { ok: boolean; status?: number } | Error) {
  const bodies: { api_key: string; batch: Record<string, unknown>[] }[] = [];
  const fn = vi.fn(async (_url: string, init?: { body?: string }) => {
    if (init?.body) bodies.push(JSON.parse(init.body));
    if (response instanceof Error) throw response;
    return { ok: response.ok, status: response.status ?? 200 } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return { bodies, fn };
}

const EVENTS = (bodies: { batch: Record<string, unknown>[] }[]) => bodies.flatMap((b) => b.batch);

describe('SignupEventsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('emits exactly one canonical event per claimed user, on the identified person', async () => {
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [row()], error: null }),
    });
    const { bodies } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    const summary = await service.sweepPendingSignups();

    const events = EVENTS(bodies);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: SIGNUP_EVENT,
      // distinct_id IS the user id, so the event merges onto the identified
      // person rather than an anonymous bucket.
      distinct_id: '11111111-1111-1111-1111-111111111111',
      // Backdated to the row's created_at — this is what makes the sweep's
      // schedule irrelevant to the monthly reconciliation.
      timestamp: '2026-09-03T09:58:00.000Z',
    });
    expect(summary).toEqual({ claimed: 1, identified: 1, anonymous: 0, released: 0 });
  });

  it.each([
    ['email signup', 'email'],
    ['Apple OAuth signup', 'apple'],
    ['Google OAuth signup', 'google'],
    // Web signups are the parity gap the 2026-06-09 client-side fix deferred.
    // Server-side there is no separate path at all: a web signup is a users row
    // like any other, which is the whole point of emitting from the insert.
    ['web signup', 'email'],
  ])('%s emits exactly one canonical event', async (_label, provider) => {
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [row({ auth_method: provider })], error: null }),
    });
    const { bodies } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    await service.sweepPendingSignups();

    const events = EVENTS(bodies);
    expect(events).toHaveLength(1);
    expect((events[0] as { properties: Record<string, unknown> }).properties.auth_method).toBe(
      provider,
    );
  });

  it('emits nothing when no users are pending — a returning sign-in is not a signup', async () => {
    // A returning user has a signup_event_log row already, so the claim RPC
    // returns nothing. There is no code path that could emit for them.
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [], error: null }),
    });
    const { fn } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    const summary = await service.sweepPendingSignups();

    expect(fn).not.toHaveBeenCalled();
    expect(summary.claimed).toBe(0);
  });

  it('does not re-emit on a second sweep (the log makes the claim idempotent)', async () => {
    let firstCall = true;
    const { client } = makeSupabase({
      claim_pending_signup_events: () => {
        if (firstCall) {
          firstCall = false;
          return { data: [row()], error: null };
        }
        // Second tick: the row is claimed, so ON CONFLICT DO NOTHING returns it
        // to nobody.
        return { data: [], error: null };
      },
    });
    const { bodies } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    await service.sweepPendingSignups();
    await service.sweepPendingSignups();

    expect(EVENTS(bodies)).toHaveLength(1);
  });

  it('counts a user who declined analytics, but never identifies them', async () => {
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({
        data: [row({ analytics_enabled: false })],
        error: null,
      }),
    });
    const { bodies } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    const summary = await service.sweepPendingSignups();

    const event = EVENTS(bodies)[0] as {
      distinct_id: string;
      properties: Record<string, unknown>;
    };
    // Constant bucket, not the user id — a tally, not a profile.
    expect(event.distinct_id).toBe(ANONYMOUS_DISTINCT_ID);
    expect(event.distinct_id).not.toContain('1111');
    expect(event.properties.$process_person_profile).toBe(false);
    // Still counted, so the reconciliation gate can pass.
    expect(summary.claimed).toBe(1);
    expect(summary.anonymous).toBe(1);
    expect(summary.identified).toBe(0);
  });

  it('never sends email or any direct identifier', async () => {
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [row()], error: null }),
    });
    const { bodies } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    await service.sweepPendingSignups();

    const payload = JSON.stringify(bodies);
    // No address anywhere. Note "email" DOES appear as the auth_method VALUE —
    // that is a provider name, not an identifier — so assert on the shape of an
    // address and on the identifier KEYS, never on the bare word.
    expect(payload).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    for (const key of ['"email"', '"full_name"', '"display_name"', '"handle"', '"name"']) {
      expect(payload).not.toContain(`${key}:`);
    }
    // Whitelist the property set outright, so adding a field is a deliberate act
    // that has to come through this test.
    const properties = (EVENTS(bodies)[0] as { properties: Record<string, unknown> }).properties;
    expect(Object.keys(properties).sort()).toEqual([
      'auth_method',
      'currency',
      'emitted_by',
      'measurement_system',
    ]);
  });

  it('releases the claims when capture fails, so the next sweep retries', async () => {
    const released: unknown[] = [];
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [row()], error: null }),
      release_signup_event_claims: (args) => {
        released.push(args);
        return { data: 1, error: null };
      },
    });
    stubFetch({ ok: false, status: 503 });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    const summary = await service.sweepPendingSignups();

    expect(released).toEqual([{ p_user_ids: ['11111111-1111-1111-1111-111111111111'] }]);
    expect(summary.released).toBe(1);
    expect(summary.identified).toBe(0);
  });

  it('releases the claims when the capture request throws', async () => {
    const released: unknown[] = [];
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [row()], error: null }),
      release_signup_event_claims: (args) => {
        released.push(args);
        return { data: 1, error: null };
      },
    });
    stubFetch(new Error('network down'));

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    const summary = await service.sweepPendingSignups();

    expect(released).toHaveLength(1);
    expect(summary.released).toBe(1);
  });

  it('does not claim anything when the PostHog token is missing', async () => {
    // Claiming first and then finding nowhere to send would burn each user's
    // one-and-only emission, and the PK on signup_event_log makes that
    // unrecoverable without hand-deleting rows.
    const { client, calls } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [row()], error: null }),
    });
    const { fn } = stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({}));
    const summary = await service.sweepPendingSignups();

    expect(calls).toHaveLength(0);
    expect(fn).not.toHaveBeenCalled();
    expect(summary).toEqual({ claimed: 0, identified: 0, anonymous: 0, released: 0 });
  });

  it('bounds one sweep with the same limit the claim RPC applies', async () => {
    const { client, calls } = makeSupabase({
      claim_pending_signup_events: () => ({ data: [], error: null }),
    });
    stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    await service.sweepPendingSignups();

    expect(calls[0]?.args).toEqual({ p_limit: MAX_SIGNUPS_PER_RUN });
  });

  it('a claim error is reported, not thrown — the sweep must never take the API down', async () => {
    const { client } = makeSupabase({
      claim_pending_signup_events: () => ({ data: null, error: { message: 'deadlock' } }),
    });
    stubFetch({ ok: true });

    const service = new SignupEventsService(client, config({ POSTHOG_PROJECT_TOKEN: 'phc_test' }));
    await expect(service.sweepPendingSignups()).resolves.toEqual({
      claimed: 0,
      identified: 0,
      anonymous: 0,
      released: 0,
    });
  });
});
