import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasExplicitAnalyticsConsent } from '../analytics-consent';
import {
  CAPTURE_LEVEL,
  captureLevelOf,
  isValidMake,
  NO_CONSENT_DISTINCT_ID,
  SERVER_EVENT,
  ServerEventsService,
} from '../server-events.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const RIDER_EMAIL = 'rider@example.com';

/** Minimal ConfigService stand-in. */
const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as never;

const WITH_TOKEN = config({ POSTHOG_PROJECT_TOKEN: 'phc_test' });

interface ClientSetup {
  /** `users.preferences`; `undefined` = no row. */
  preferences?: unknown;
  usersError?: { message: string };
  /** `auth.users.raw_user_meta_data`. */
  signupMetadata?: unknown;
  authError?: { message: string };
  /** Rides of this rider that started before the saved one. */
  earlierRides?: number;
  ridesError?: { message: string };
}

/** Fake service-role client: the users row, the auth user and the earlier-rides count. */
function makeAdmin(setup: ClientSetup) {
  const ridesFilters: { method: string; args: unknown[] }[] = [];
  const getUserById = vi.fn(async () =>
    setup.authError
      ? { data: { user: null }, error: setup.authError }
      : {
          data: { user: { id: USER_ID, email: RIDER_EMAIL, user_metadata: setup.signupMetadata } },
          error: null,
        },
  );
  const from = vi.fn((table: string) => {
    if (table === 'users') {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data:
            setup.preferences === undefined
              ? null
              : { preferences: setup.preferences, email: RIDER_EMAIL },
          error: setup.usersError ?? null,
        }),
      };
      return chain;
    }
    const result = {
      count: setup.ridesError ? null : (setup.earlierRides ?? 0),
      error: setup.ridesError ?? null,
    };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'lt']) {
      chain[m] = (...args: unknown[]) => {
        ridesFilters.push({ method: m, args });
        return chain;
      };
    }
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  });
  const client = { from, auth: { admin: { getUserById } } } as unknown as SupabaseClient;
  return { client, getUserById, ridesFilters };
}

/** Captures what would be POSTed to PostHog. */
function stubFetch(response: { ok: boolean; status?: number } | Error = { ok: true }) {
  const events: Record<string, unknown>[] = [];
  const fn = vi.fn(async (_url: string, init?: { body?: string }) => {
    if (init?.body) events.push(...JSON.parse(init.body).batch);
    if (response instanceof Error) throw response;
    return { ok: response.ok, status: response.status ?? 200 } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return { events, fn };
}

const BIKE = { make: 'Honda', model: 'CB500F', mileageUnit: 'km' };
const RIDE = {
  rideId: 'ride-1',
  startedAt: '2026-11-13T10:00:00.000Z',
  endedAt: '2026-11-13T10:00:20.000Z',
  distanceM: 12.4,
  durationS: 20,
  endSource: 'rider_phone',
};

const CONSENT_CASES = [
  { name: 'decision true', setup: { preferences: { privacy: { analyticsEnabled: true } } } },
  { name: 'decision false', setup: { preferences: { privacy: { analyticsEnabled: false } } } },
  { name: 'decision missing', setup: { preferences: {}, signupMetadata: {} } },
  {
    name: 'sign-up "yes" only',
    setup: { preferences: {}, signupMetadata: { analytics_consent: true } },
  },
] as const;

const SENDS = [
  {
    event: SERVER_EVENT.ONBOARDING_BIKE_CREATED,
    send: (s: ServerEventsService) => s.captureOnboardingBikeCreated(USER_ID, BIKE),
  },
  {
    event: SERVER_EVENT.RIDE_SAVED,
    send: (s: ServerEventsService) => s.captureRideSaved(USER_ID, RIDE),
  },
] as const;

describe('hasExplicitAnalyticsConsent', () => {
  it('only a stored "yes" is consent; NULL and undefined are not', () => {
    expect(hasExplicitAnalyticsConsent(true)).toBe(true);
    expect(hasExplicitAnalyticsConsent(false)).toBe(false);
    expect(hasExplicitAnalyticsConsent(null)).toBe(false);
    expect(hasExplicitAnalyticsConsent(undefined)).toBe(false);
  });
});

describe('isValidMake / captureLevelOf (FS-R2-5)', () => {
  it('junk makes under 3 letters are invalid; real makes are valid', () => {
    expect(isValidMake('A')).toBe(false);
    expect(isValidMake('V')).toBe(false);
    expect(isValidMake(' H1 ')).toBe(false);
    expect(isValidMake('12345')).toBe(false);
    expect(isValidMake('KTM')).toBe(true);
    expect(isValidMake('Honda')).toBe(true);
    expect(isValidMake('tm racing')).toBe(true);
  });

  it('model given → model, make only → make, nothing → none', () => {
    expect(captureLevelOf('Honda', 'CB500F')).toBe(CAPTURE_LEVEL.MODEL);
    expect(captureLevelOf('Honda', ' ')).toBe(CAPTURE_LEVEL.MAKE);
    expect(captureLevelOf('Honda', null)).toBe(CAPTURE_LEVEL.MAKE);
    expect(captureLevelOf('', null)).toBe(CAPTURE_LEVEL.NONE);
  });
});

describe('ServerEventsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe.each(SENDS)('$event consent', ({ event, send }) => {
    it.each(CONSENT_CASES)('$name', async ({ name, setup }) => {
      const { client } = makeAdmin(setup);
      const { events } = stubFetch();

      await send(new ServerEventsService(client, WITH_TOKEN));

      expect(events).toHaveLength(1);
      const [sent] = events;
      expect(sent.event).toBe(event);
      const payload = JSON.stringify(sent);
      expect(payload).not.toContain(RIDER_EMAIL);
      if (name === 'decision true' || name === 'sign-up "yes" only') {
        expect(sent.distinct_id).toBe(USER_ID);
        expect(sent.properties).not.toHaveProperty('$process_person_profile');
      } else {
        expect(payload).not.toContain(USER_ID);
        expect(sent.distinct_id).toBe(NO_CONSENT_DISTINCT_ID[event]);
        expect(sent.properties).toMatchObject({
          $process_person_profile: false,
          analytics_consent: false,
        });
      }
    });

    it('an unreadable decision counts as no consent', async () => {
      const { client } = makeAdmin({ usersError: { message: 'down' } });
      const { events } = stubFetch();

      await send(new ServerEventsService(client, WITH_TOKEN));

      expect(events[0].distinct_id).toBe(NO_CONSENT_DISTINCT_ID[event]);
    });

    it('never throws when PostHog fails', async () => {
      const { client } = makeAdmin({ preferences: { privacy: { analyticsEnabled: true } } });
      stubFetch(new Error('network down'));

      await expect(send(new ServerEventsService(client, WITH_TOKEN))).resolves.toBeUndefined();
    });

    it('sends nothing without a PostHog token', async () => {
      const { client } = makeAdmin({ preferences: {} });
      const { fn } = stubFetch();

      await send(new ServerEventsService(client, config({})));

      expect(fn).not.toHaveBeenCalled();
    });
  });

  it('onboarding_bike_created carries capture_level, make_valid and mileage_unit, never the make', async () => {
    const { client } = makeAdmin({ preferences: { privacy: { analyticsEnabled: true } } });
    const { events } = stubFetch();

    await new ServerEventsService(client, WITH_TOKEN).captureOnboardingBikeCreated(USER_ID, {
      make: 'A',
      model: null,
      mileageUnit: undefined,
    });

    expect(events[0].properties).toMatchObject({
      capture_level: CAPTURE_LEVEL.MAKE,
      make_valid: false,
      mileage_unit: 'mi',
      $geoip_disable: true,
    });
    expect(JSON.stringify(events[0])).not.toContain('"A"');
  });

  it('ride_saved: first ride below the floor', async () => {
    const { client, ridesFilters } = makeAdmin({
      preferences: { privacy: { analyticsEnabled: true } },
      earlierRides: 0,
    });
    const { events } = stubFetch();

    await new ServerEventsService(client, WITH_TOKEN).captureRideSaved(USER_ID, RIDE);

    expect(events[0]).toMatchObject({
      timestamp: RIDE.endedAt,
      properties: {
        below_min: true,
        distance_m: 12,
        duration_s: 20,
        is_first: true,
        save_trigger: 'rider_phone',
      },
    });
    // Deleted rides count too (fs-po4b-first-ride.sql), so no deleted_at filter.
    expect(ridesFilters).toContainEqual({ method: 'eq', args: ['user_id', USER_ID] });
    expect(ridesFilters).toContainEqual({ method: 'lt', args: ['started_at', RIDE.startedAt] });
    expect(ridesFilters.some((f) => f.args[0] === 'deleted_at')).toBe(false);
  });

  it('ride_saved: a later real ride; null distance counts as sub-floor; no endSource → unknown', async () => {
    const { client } = makeAdmin({ preferences: {}, earlierRides: 2 });
    const { events } = stubFetch();
    const service = new ServerEventsService(client, WITH_TOKEN);

    await service.captureRideSaved(USER_ID, { ...RIDE, distanceM: 4200, durationS: 600 });
    await service.captureRideSaved(USER_ID, {
      ...RIDE,
      distanceM: null,
      durationS: 600,
      endSource: null,
    });

    expect(events[0].properties).toMatchObject({ below_min: false, is_first: false });
    expect(events[1].properties).toMatchObject({
      below_min: true,
      distance_m: null,
      save_trigger: 'unknown',
    });
  });

  it('ride_saved is dropped, not guessed, when the first-ride count fails', async () => {
    const { client } = makeAdmin({ preferences: {}, ridesError: { message: 'down' } });
    const { fn } = stubFetch();

    await expect(
      new ServerEventsService(client, WITH_TOKEN).captureRideSaved(USER_ID, RIDE),
    ).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });
});
