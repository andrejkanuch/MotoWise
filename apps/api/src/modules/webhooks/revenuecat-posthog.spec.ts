import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsDecision } from '../analytics/analytics-consent';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';
import {
  buildRevenueCatPostHogEvent,
  consentRegionForCountry,
  hasPurchaseAnalyticsConsent,
  OPT_IN_COUNTRIES,
  RC_NO_CONSENT_DISTINCT_ID,
  RC_POSTHOG_EVENT_NAMES,
  revenueCatPostHogEventName,
  type StoredAnalyticsDecisions,
} from './revenuecat-posthog';

/**
 * RevenueCat → PostHog server-side capture. Replaces RevenueCat's own PostHog
 * integration so paid subscribers can be broken down by source while honouring
 * the rider's analytics opt-out (the rule shared with the signup sweep).
 */
const USER_ID = '11111111-1111-1111-1111-111111111111';
const RC_EVENT_ID = 'CD489E0E-6A9A-4B04-B6E3-4ED6C1D9C3F7';
const POSTHOG_TOKEN = 'phc_test';

/** Saved decisions: the in-app account setting, and the sign-up/banner metadata. */
const decided = (
  account: AnalyticsDecision,
  signup: AnalyticsDecision = null,
): StoredAnalyticsDecisions => ({ account, signup });

function rcEvent(overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent {
  return {
    id: RC_EVENT_ID,
    type: 'INITIAL_PURCHASE',
    app_user_id: USER_ID,
    store: 'PLAY_STORE',
    environment: 'PRODUCTION',
    period_type: 'NORMAL',
    product_id: 'motovault_pro_annual_v4',
    price: 59.99,
    currency: 'EUR',
    price_in_purchased_currency: 54.99,
    event_timestamp_ms: 1_790_000_000_000,
    ...overrides,
  };
}

describe('revenueCatPostHogEventName', () => {
  it('keeps the names the old RevenueCat integration sent', () => {
    expect(revenueCatPostHogEventName('INITIAL_PURCHASE')).toBe('rc_initial_purchase');
    expect(revenueCatPostHogEventName('RENEWAL')).toBe('rc_renewal');
    expect(revenueCatPostHogEventName('CANCELLATION')).toBe('rc_cancellation');
    expect(revenueCatPostHogEventName('EXPIRATION')).toBe('rc_expiration');
    expect(revenueCatPostHogEventName('BILLING_ISSUE')).toBe('rc_billing_issue');
  });

  it('names the rest rc_<lowercase type>', () => {
    for (const type of ['UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE']) {
      expect(revenueCatPostHogEventName(type)).toBe(`rc_${type.toLowerCase()}`);
    }
  });

  it('sends nothing for unmapped types, including inherited object keys', () => {
    for (const type of ['TRANSFER', 'EXPERIMENT_ENROLLMENT', 'SUBSCRIPTION_PAUSED', 'toString']) {
      expect(revenueCatPostHogEventName(type)).toBeNull();
    }
  });
});

describe('hasPurchaseAnalyticsConsent', () => {
  const web = rcEvent({ store: 'RC_BILLING' });
  const app = rcEvent({ store: 'APP_STORE' });

  it('web: an app "yes" with a web banner "no" stays anonymous (a no anywhere wins)', () => {
    expect(hasPurchaseAnalyticsConsent(web, decided(true, false))).toBe(false);
  });

  it('web: an app "yes" with no banner metadata is identified', () => {
    expect(hasPurchaseAnalyticsConsent(web, decided(true, null))).toBe(true);
  });

  it('web: a banner "yes" with no app setting is identified; a "no" in the app wins', () => {
    expect(hasPurchaseAnalyticsConsent(web, decided(null, true))).toBe(true);
    expect(hasPurchaseAnalyticsConsent(web, decided(false, true))).toBe(false);
  });

  it('web: nothing saved and no country is not consent (fail closed)', () => {
    expect(hasPurchaseAnalyticsConsent(web, decided(null, null))).toBe(false);
  });

  it('web: a US purchase with nothing saved is identified (opt-out region)', () => {
    const us = rcEvent({ store: 'RC_BILLING', country_code: 'US' });
    expect(hasPurchaseAnalyticsConsent(us, decided(null, null))).toBe(true);
  });

  it('web: a DE purchase with nothing saved is anonymous (opt-in region)', () => {
    const de = rcEvent({ store: 'RC_BILLING', country_code: 'DE' });
    expect(hasPurchaseAnalyticsConsent(de, decided(null, null))).toBe(false);
    expect(hasPurchaseAnalyticsConsent(de, decided(null, true))).toBe(true);
  });

  it('web: an explicit no wins even in an opt-out region', () => {
    const us = rcEvent({ store: 'RC_BILLING', country_code: 'US' });
    expect(hasPurchaseAnalyticsConsent(us, decided(null, false))).toBe(false);
    expect(hasPurchaseAnalyticsConsent(us, decided(false, null))).toBe(false);
    expect(hasPurchaseAnalyticsConsent(us, decided(true, false))).toBe(false);
  });

  it('web: a missing or malformed country is anonymous', () => {
    for (const country_code of [undefined, null, '', 'XYZ', '1A']) {
      const event = rcEvent({ store: 'STRIPE', country_code });
      expect(hasPurchaseAnalyticsConsent(event, decided(null, null))).toBe(false);
    }
  });

  it('app store: the buyer country changes nothing', () => {
    const deApp = rcEvent({ store: 'APP_STORE', country_code: 'DE' });
    expect(hasPurchaseAnalyticsConsent(deApp, decided(null, null))).toBe(true);
  });

  it('app store: unchanged — the account decision wins, NULL counts as consent', () => {
    expect(hasPurchaseAnalyticsConsent(app, decided(true, false))).toBe(true);
    expect(hasPurchaseAnalyticsConsent(app, decided(false, true))).toBe(false);
    expect(hasPurchaseAnalyticsConsent(app, decided(null, false))).toBe(false);
    expect(hasPurchaseAnalyticsConsent(app, decided(null, null))).toBe(true);
  });
});

describe('consentRegionForCountry', () => {
  it('lists the EEA (30), its outermost regions with own codes (7), the UK and Switzerland', () => {
    expect(OPT_IN_COUNTRIES).toHaveLength(39);
    expect(new Set(OPT_IN_COUNTRIES).size).toBe(39);
    expect(OPT_IN_COUNTRIES).not.toContain('GI');
    for (const code of [
      'DE',
      'FR',
      'IS',
      'LI',
      'NO',
      'GB',
      'CH',
      'RE',
      'GP',
      'MQ',
      'GF',
      'YT',
      'MF',
      'AX',
    ]) {
      expect(consentRegionForCountry(code)).toBe('opt_in');
    }
  });

  it('treats any other known country as opt-out, case-insensitively', () => {
    for (const code of ['US', 'BR', 'MX', 'ca', 'JP']) {
      expect(consentRegionForCountry(code)).toBe('opt_out');
    }
  });

  it('reports a missing or malformed country as unknown', () => {
    for (const code of [undefined, null, '', ' ', 'USA', '12']) {
      expect(consentRegionForCountry(code)).toBe('unknown');
    }
  });
});

describe('buildRevenueCatPostHogEvent', () => {
  const NAME = RC_POSTHOG_EVENT_NAMES.INITIAL_PURCHASE;

  it('identifies a consented rider by their Supabase user id', () => {
    const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(true));
    expect(built).toMatchObject({
      event: 'rc_initial_purchase',
      distinct_id: USER_ID,
      uuid: RC_EVENT_ID.toLowerCase(),
      timestamp: new Date(1_790_000_000_000).toISOString(),
    });
    expect(built.properties).toMatchObject({
      revenue: 59.99,
      currency: 'USD',
      purchased_currency: 'EUR',
      price_in_purchased_currency: 54.99,
      store: 'PLAY_STORE',
      purchase_source: 'android',
      environment: 'PRODUCTION',
      is_trial: false,
      is_paid_conversion: true,
    });
    expect(built.properties).not.toHaveProperty('$process_person_profile');
  });

  it('treats no saved decision as consent for an app-store purchase (signup sweep rule)', () => {
    for (const store of ['APP_STORE', 'PLAY_STORE']) {
      expect(buildRevenueCatPostHogEvent(rcEvent({ store }), NAME, decided(null)).distinct_id).toBe(
        USER_ID,
      );
    }
  });

  it('treats no saved decision as NO consent for a web purchase', () => {
    for (const store of ['STRIPE', 'RC_BILLING']) {
      const built = buildRevenueCatPostHogEvent(rcEvent({ store }), NAME, decided(null));
      expect(built.distinct_id).toBe(RC_NO_CONSENT_DISTINCT_ID);
      expect(built.properties).toMatchObject({ $process_person_profile: false });
    }
  });

  it('identifies a web purchase only on an explicit yes, and never on a no', () => {
    const web = rcEvent({ store: 'RC_BILLING' });
    expect(buildRevenueCatPostHogEvent(web, NAME, decided(true)).distinct_id).toBe(USER_ID);
    expect(buildRevenueCatPostHogEvent(web, NAME, decided(false)).distinct_id).toBe(
      RC_NO_CONSENT_DISTINCT_ID,
    );
  });

  it('puts a rider who declined into the anonymous bucket with no person profile', () => {
    const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(false));
    expect(built.distinct_id).toBe(RC_NO_CONSENT_DISTINCT_ID);
    expect(built.properties).toMatchObject({
      $process_person_profile: false,
      analytics_consent: false,
    });
    expect(JSON.stringify(built)).not.toContain(USER_ID);
  });

  it('drops the RevenueCat event id for a rider who declined (it joins back to the account)', () => {
    const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(false));
    // What actually goes over the wire: undefined keys are not serialised.
    const sent = JSON.parse(JSON.stringify(built));
    expect(sent).not.toHaveProperty('uuid');
    expect(sent.properties).not.toHaveProperty('rc_event_id');
    expect(JSON.stringify(built).toLowerCase()).not.toContain(RC_EVENT_ID.toLowerCase());
  });

  it('cuts a declined rider’s timestamp to the start of the UTC purchase day', () => {
    // event_timestamp_ms 1_790_000_000_000 = 2026-09-21T14:13:20.000Z
    const declined = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(false));
    expect(declined.timestamp).toBe('2026-09-21T00:00:00.000Z');
    const consented = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(true));
    expect(consented.timestamp).toBe('2026-09-21T14:13:20.000Z');
  });

  it('keeps revenue on a declined rider’s purchase (dashboard totals)', () => {
    const declined = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(false));
    expect(declined.properties).toMatchObject({ revenue: 59.99, currency: 'USD' });
  });

  it('keeps the RevenueCat event id for a consented rider', () => {
    const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(true));
    expect(built.uuid).toBe(RC_EVENT_ID.toLowerCase());
    expect(built.properties.rc_event_id).toBe(RC_EVENT_ID);
  });

  it('marks a trial start, with no revenue', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ period_type: 'TRIAL', price: 0 }),
      NAME,
      decided(true),
    );
    expect(built.properties).toMatchObject({ is_trial: true, is_paid_conversion: false });
    expect(built.properties.revenue).toBe(0);
  });

  it('marks the trial-converting renewal as the paid conversion', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ type: 'RENEWAL', is_trial_conversion: true }),
      RC_POSTHOG_EVENT_NAMES.RENEWAL,
      decided(true),
    );
    expect(built.properties).toMatchObject({ is_trial_conversion: true, is_paid_conversion: true });
  });

  it('reports no revenue on a cancellation', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' }),
      RC_POSTHOG_EVENT_NAMES.CANCELLATION,
      decided(true),
    );
    expect(built.properties).not.toHaveProperty('revenue');
    expect(built.properties).toMatchObject({ cancel_reason: 'UNSUBSCRIBE', price_usd: 59.99 });
  });

  it('never geolocates the API server, consented or not', () => {
    for (const decision of [true, false, null]) {
      const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, decided(decision));
      expect(built.properties.$geoip_disable).toBe(true);
    }
  });

  it('maps Web Billing to the web purchase source', () => {
    for (const store of ['STRIPE', 'RC_BILLING']) {
      const built = buildRevenueCatPostHogEvent(rcEvent({ store }), NAME, decided(true));
      expect(built.properties.purchase_source).toBe('web');
    }
  });

  it('never forwards subscriber attributes', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ subscriber_attributes: { $email: { value: 'x' } } }),
      NAME,
      decided(true),
    );
    expect(built.properties).not.toHaveProperty('subscriber_attributes');
  });
});

describe('RevenueCatService → PostHog capture', () => {
  let service: RevenueCatService;
  let usersResult: { data: unknown; error: unknown };
  let authResult: { data: unknown; error: unknown };
  let adminClient: {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    auth: { admin: { getUserById: ReturnType<typeof vi.fn> } };
  };
  let fetchMock: ReturnType<typeof vi.fn>;
  let posthogToken: string | undefined;

  /** Drains the fire-and-forget promise chains (Meta CAPI, PostHog). */
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  const posthogBatches = () =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith('/batch/'))
      .map(([, init]) => JSON.parse(init.body) as { api_key: string; batch: unknown[] });

  beforeEach(() => {
    usersResult = { data: { preferences: { privacy: { analyticsEnabled: true } } }, error: null };
    authResult = { data: { user: { user_metadata: {} } }, error: null };
    posthogToken = POSTHOG_TOKEN;
    const usersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => usersResult),
      // Meta CAPI email lookup; no email keeps Meta out of the way.
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    adminClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue(usersChain),
      auth: { admin: { getUserById: vi.fn(async () => authResult) } },
    };
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    service = new RevenueCatService(
      {
        get: vi.fn((key: string) => (key === 'POSTHOG_PROJECT_TOKEN' ? posthogToken : undefined)),
      } as never,
      adminClient as never,
      { sendAppEvent: vi.fn() } as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a consented rider’s purchase to the EU host, identified', async () => {
    await service.processEvent(rcEvent());
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('https://eu.i.posthog.com/batch/', expect.anything());
    const [body] = posthogBatches();
    expect(body.api_key).toBe(POSTHOG_TOKEN);
    expect(body.batch).toEqual([
      expect.objectContaining({
        event: 'rc_initial_purchase',
        distinct_id: USER_ID,
        properties: expect.objectContaining({ $geoip_disable: true }),
      }),
    ]);
  });

  it('sends a declined rider’s purchase to the anonymous bucket', async () => {
    usersResult = { data: { preferences: { privacy: { analyticsEnabled: false } } }, error: null };
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({
        distinct_id: RC_NO_CONSENT_DISTINCT_ID,
        properties: expect.objectContaining({ $process_person_profile: false }),
      }),
    ]);
  });

  it('falls back to the decision sent with sign-up when the account has none', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    authResult = { data: { user: { user_metadata: { analytics_consent: false } } }, error: null };
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('identifies a rider with no decision anywhere (NULL counts as consent)', async () => {
    usersResult = { data: { preferences: null }, error: null };
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()[0].batch).toEqual([expect.objectContaining({ distinct_id: USER_ID })]);
  });

  it('sends a web purchase with no saved decision anonymously', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    await service.processEvent(rcEvent({ store: 'RC_BILLING' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('identifies a web purchase when the cookie-banner yes was sent with sign-up', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    authResult = { data: { user: { user_metadata: { analytics_consent: true } } }, error: null };
    await service.processEvent(rcEvent({ store: 'RC_BILLING' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([expect.objectContaining({ distinct_id: USER_ID })]);
  });

  it('identifies a US web purchase with nothing saved (opt-out region)', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    await service.processEvent(rcEvent({ store: 'RC_BILLING', country_code: 'US' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([expect.objectContaining({ distinct_id: USER_ID })]);
  });

  it('sends a DE web purchase with nothing saved anonymously (opt-in region)', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    await service.processEvent(rcEvent({ store: 'RC_BILLING', country_code: 'DE' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('sends a US web purchase anonymously when the banner said no', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    authResult = { data: { user: { user_metadata: { analytics_consent: false } } }, error: null };
    await service.processEvent(rcEvent({ store: 'RC_BILLING', country_code: 'US' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('sends a web purchase anonymously when the app says yes but the banner said no', async () => {
    authResult = { data: { user: { user_metadata: { analytics_consent: false } } }, error: null };
    await service.processEvent(rcEvent({ store: 'RC_BILLING' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('identifies a web purchase when the app says yes and there is no banner metadata', async () => {
    await service.processEvent(rcEvent({ store: 'RC_BILLING' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([expect.objectContaining({ distinct_id: USER_ID })]);
  });

  it('leaves an app-store purchase unaffected: app "yes" wins, metadata is not read', async () => {
    authResult = { data: { user: { user_metadata: { analytics_consent: false } } }, error: null };
    await service.processEvent(rcEvent({ store: 'PLAY_STORE' }));
    await flush();
    expect(posthogBatches()[0].batch).toEqual([expect.objectContaining({ distinct_id: USER_ID })]);
    expect(adminClient.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it('fails closed to the anonymous bucket when the sign-up metadata read errors', async () => {
    usersResult = { data: { preferences: {} }, error: null };
    authResult = { data: { user: null }, error: { message: 'auth unavailable' } };
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('fails closed to the anonymous bucket when the account cannot be read', async () => {
    usersResult = { data: null, error: { message: 'boom' } };
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()[0].batch).toEqual([
      expect.objectContaining({ distinct_id: RC_NO_CONSENT_DISTINCT_ID }),
    ]);
  });

  it('skips sandbox events entirely', async () => {
    await service.processEvent(rcEvent({ environment: 'SANDBOX' }));
    await flush();
    expect(posthogBatches()).toHaveLength(0);
    expect(adminClient.rpc).toHaveBeenCalled();
  });

  it('skips unmapped event types', async () => {
    await service.processEvent(rcEvent({ type: 'EXPERIMENT_ENROLLMENT' }));
    await flush();
    expect(posthogBatches()).toHaveLength(0);
  });

  it('sends nothing when POSTHOG_PROJECT_TOKEN is unset', async () => {
    posthogToken = undefined;
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()).toHaveLength(0);
  });

  it('does not re-send a duplicate delivery (already_processed)', async () => {
    adminClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'event already_processed' },
    });
    await service.processEvent(rcEvent());
    await flush();
    expect(posthogBatches()).toHaveLength(0);
  });

  it('does not fail the webhook when PostHog rejects or is unreachable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(service.processEvent(rcEvent())).resolves.toBeUndefined();
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(service.processEvent(rcEvent({ id: 'evt-2' }))).resolves.toBeUndefined();
    await flush();
    expect(posthogBatches()).toHaveLength(2);
  });

  it('does not fail the webhook when the consent lookup throws', async () => {
    adminClient.auth.admin.getUserById.mockRejectedValueOnce(new Error('auth down'));
    usersResult = { data: { preferences: {} }, error: null };
    await expect(service.processEvent(rcEvent())).resolves.toBeUndefined();
    await flush();
    expect(posthogBatches()).toHaveLength(0);
  });
});
