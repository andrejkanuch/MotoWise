import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevenueCatEvent } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';
import {
  buildRevenueCatPostHogEvent,
  RC_NO_CONSENT_DISTINCT_ID,
  RC_POSTHOG_EVENT_NAMES,
  revenueCatPostHogEventName,
} from './revenuecat-posthog';

/**
 * RevenueCat → PostHog server-side capture. Replaces RevenueCat's own PostHog
 * integration so paid subscribers can be broken down by source while honouring
 * the rider's analytics opt-out (the rule shared with the signup sweep).
 */
const USER_ID = '11111111-1111-1111-1111-111111111111';
const RC_EVENT_ID = 'CD489E0E-6A9A-4B04-B6E3-4ED6C1D9C3F7';
const POSTHOG_TOKEN = 'phc_test';

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

describe('buildRevenueCatPostHogEvent', () => {
  const NAME = RC_POSTHOG_EVENT_NAMES.INITIAL_PURCHASE;

  it('identifies a consented rider by their Supabase user id', () => {
    const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, true);
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

  it('treats no saved decision as consent (same rule as the signup sweep)', () => {
    expect(buildRevenueCatPostHogEvent(rcEvent(), NAME, null).distinct_id).toBe(USER_ID);
  });

  it('puts a rider who declined into the anonymous bucket with no person profile', () => {
    const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, false);
    expect(built.distinct_id).toBe(RC_NO_CONSENT_DISTINCT_ID);
    expect(built.properties).toMatchObject({
      $process_person_profile: false,
      analytics_consent: false,
    });
    expect(JSON.stringify(built)).not.toContain(USER_ID);
  });

  it('marks a trial start, with no revenue', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ period_type: 'TRIAL', price: 0 }),
      NAME,
      true,
    );
    expect(built.properties).toMatchObject({ is_trial: true, is_paid_conversion: false });
    expect(built.properties.revenue).toBe(0);
  });

  it('marks the trial-converting renewal as the paid conversion', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ type: 'RENEWAL', is_trial_conversion: true }),
      RC_POSTHOG_EVENT_NAMES.RENEWAL,
      true,
    );
    expect(built.properties).toMatchObject({ is_trial_conversion: true, is_paid_conversion: true });
  });

  it('reports no revenue on a cancellation', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' }),
      RC_POSTHOG_EVENT_NAMES.CANCELLATION,
      true,
    );
    expect(built.properties).not.toHaveProperty('revenue');
    expect(built.properties).toMatchObject({ cancel_reason: 'UNSUBSCRIBE', price_usd: 59.99 });
  });

  it('never geolocates the API server, consented or not', () => {
    for (const decision of [true, false, null]) {
      const built = buildRevenueCatPostHogEvent(rcEvent(), NAME, decision);
      expect(built.properties.$geoip_disable).toBe(true);
    }
  });

  it('maps Web Billing to the web purchase source', () => {
    for (const store of ['STRIPE', 'RC_BILLING']) {
      const built = buildRevenueCatPostHogEvent(rcEvent({ store }), NAME, true);
      expect(built.properties.purchase_source).toBe('web');
    }
  });

  it('never forwards subscriber attributes', () => {
    const built = buildRevenueCatPostHogEvent(
      rcEvent({ subscriber_attributes: { $email: { value: 'x' } } }),
      NAME,
      true,
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
