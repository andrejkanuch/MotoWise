const mockLogOut = jest.fn();
const mockIsAnonymous = jest.fn();
const mockConfigure = jest.fn().mockResolvedValue(undefined);
const mockGetCustomerInfo = jest.fn().mockResolvedValue({
  entitlements: { active: {} },
});
const mockAddListener = jest.fn(() => jest.fn());
const mockRemoveListener = jest.fn();

const mockPurchases = {
  configure: mockConfigure,
  logOut: mockLogOut,
  isAnonymous: mockIsAnonymous,
  getCustomerInfo: mockGetCustomerInfo,
  addCustomerInfoUpdateListener: mockAddListener,
  removeCustomerInfoUpdateListener: mockRemoveListener,
  logIn: jest.fn(),
  syncAttributesAndOfferingsIfNeeded: jest.fn(),
  setAttributes: jest.fn(),
  setEmail: jest.fn(),
  collectDeviceIdentifiers: jest.fn().mockResolvedValue(undefined),
  enableAdServicesAttributionTokenCollection: jest.fn().mockResolvedValue(undefined),
  getOfferings: jest.fn().mockResolvedValue({
    current: { identifier: 'default', availablePackages: [{}] },
    all: {},
  }),
  getCurrentOfferingForPlacement: jest.fn().mockResolvedValue(null),
};

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
}));

jest.mock('expo-constants', () => ({
  appOwnership: null,
}));

const mockPresentPaywallUI = jest.fn();
jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  PAYWALL_RESULT: {
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
  },
  CustomVariableValue: { string: (value: string) => value },
  default: { presentPaywall: (...args: unknown[]) => mockPresentPaywallUI(...args) },
}));
jest.mock('../paywall-error-alert', () => ({ showPaywallUnavailable: jest.fn() }));

const mockConsent = jest.fn<boolean, []>();
jest.mock('../store-review', () => ({
  REVIEW_ACTION: { PRO_SUBSCRIBED: 'pro_subscribed' },
  recordReviewAction: jest.fn(),
}));
jest.mock('../analytics-consent', () => ({
  getStoredAnalyticsConsent: () => mockConsent(),
}));

const mockGetStoredUtm = jest.fn<Promise<Record<string, string> | null>, []>();
jest.mock('../meta-attribution', () => ({
  getStoredUtmProperties: () => mockGetStoredUtm(),
  getStoredFbclid: jest.fn().mockResolvedValue(null),
}));

const mockCaptureException = jest.fn();
const mockAddBreadcrumb = jest.fn();
const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

const mockLoggerWarn = jest.fn();
jest.mock('../logger', () => ({
  logger: { warn: (...args: unknown[]) => mockLoggerWarn(...args) },
}));

jest.mock('../../stores/subscription.store', () => ({
  useSubscriptionStore: {
    getState: () => ({
      setAvailable: jest.fn(),
      setPro: jest.fn(),
      setTrialing: jest.fn(),
      setVerified: jest.fn(),
    }),
  },
}));

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { AppState, type AppStateStatus } from 'react-native';
import {
  PAYWALL_GATE_EVENT,
  PAYWALL_GATE_POLICY,
  PAYWALL_SESSION_BACKGROUND_RESET_MS,
  PAYWALL_SUPPRESSED_REASON,
  PAYWALL_TRIGGER,
  recordOnboardingCompleted,
  resetPaywallSession,
} from '../paywall-session';
import { ONBOARDING_PAYWALL_SURFACE } from '../paywall-surfaces';
import {
  configureRcAttribution,
  loginRevenueCat,
  logoutRevenueCat,
  paywallHistoryLoader,
  presentPaywall,
  resyncTrialReminder,
  setOnboardingAttributes,
  setSelfReportedSource,
  trialReminderLoader,
  waitForRevenueCatLogin,
} from '../subscription';

beforeAll(() => {
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'test_key';
  process.env.EXPO_OS = 'ios';
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no consent, no stored UTM — keeps doInit's attribution branch off
  // for the existing tests. Individual attribution tests opt in explicitly.
  mockConsent.mockReturnValue(false);
  mockGetStoredUtm.mockResolvedValue(null);
});

describe('logoutRevenueCat', () => {
  it('skips logOut when user is anonymous', async () => {
    mockIsAnonymous.mockResolvedValue(true);

    await logoutRevenueCat();

    expect(mockIsAnonymous).toHaveBeenCalled();
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('calls logOut when user is NOT anonymous', async () => {
    mockIsAnonymous.mockResolvedValue(false);
    mockLogOut.mockResolvedValue({ entitlements: { active: {} } });

    await logoutRevenueCat();

    expect(mockIsAnonymous).toHaveBeenCalled();
    expect(mockLogOut).toHaveBeenCalled();
  });

  it('handles isAnonymous throwing gracefully', async () => {
    const error = new Error('SDK not ready');
    mockIsAnonymous.mockRejectedValue(error);

    await logoutRevenueCat();

    expect(mockLogOut).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      source: 'revenuecat.logoutRevenueCat',
    });
  });

  it('returns early in Expo Go', async () => {
    const Constants = require('expo-constants');
    Constants.appOwnership = 'expo';

    await logoutRevenueCat();

    expect(mockIsAnonymous).not.toHaveBeenCalled();
    expect(mockLogOut).not.toHaveBeenCalled();

    Constants.appOwnership = null;
  });
});

describe('waitForRevenueCatLogin', () => {
  it('resolves immediately when no login is in flight', async () => {
    await expect(waitForRevenueCatLogin(10_000)).resolves.toBeUndefined();
  });

  it('waits for an in-flight logIn to finish', async () => {
    let finishLogIn: () => void = () => {};
    mockPurchases.logIn.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLogIn = resolve;
        }),
    );
    const login = loginRevenueCat('user-1');
    let waited = false;
    const wait = waitForRevenueCatLogin(10_000).then(() => {
      waited = true;
    });

    // Let init + getPurchases settle so logIn is actually pending.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(waited).toBe(false);

    finishLogIn();
    await login;
    await wait;
    expect(waited).toBe(true);
  });

  it('gives up after the timeout when logIn hangs', async () => {
    let finishLogIn: () => void = () => {};
    mockPurchases.logIn.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLogIn = resolve;
        }),
    );
    const login = loginRevenueCat('user-2');
    jest.useFakeTimers();
    try {
      // Let init + getPurchases settle so logIn is actually pending.
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const wait = waitForRevenueCatLogin(3000);
      jest.advanceTimersByTime(3001);
      await expect(wait).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
      // Settle the hung login so no in-flight state leaks into later tests.
      finishLogIn();
      await login;
    }
  });
});

describe('resyncTrialReminder', () => {
  const mockReconcileTrialReminder = jest.fn().mockResolvedValue(undefined);
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    trialReminderLoader.load = jest.fn(() =>
      Promise.resolve({
        reconcileTrialReminder: mockReconcileTrialReminder,
      } as unknown as typeof import('../trial-reminder')),
    );
  });

  it('reconciles the reminder with the Pro entitlement from fresh customer info', async () => {
    const pro = { periodType: 'TRIAL', willRenew: true, expirationDate: '2026-10-14T10:00:00Z' };
    mockGetCustomerInfo.mockResolvedValueOnce({
      entitlements: { active: { [REVENUECAT_ENTITLEMENT_PRO]: pro } },
    });

    await resyncTrialReminder();
    await flush();

    expect(mockReconcileTrialReminder).toHaveBeenCalledWith(pro);
  });

  it('reconciles with no entitlement when the rider is not Pro, so a reminder is cleared', async () => {
    mockGetCustomerInfo.mockResolvedValueOnce({ entitlements: { active: {} } });

    await resyncTrialReminder();
    await flush();

    expect(mockReconcileTrialReminder).toHaveBeenCalledWith(undefined);
  });
});

describe('loginRevenueCat', () => {
  const USER_ID = 'user-123';
  const EMAIL = 'rider@example.com';

  it('calls logIn and then setEmail(email) once when an email is present', async () => {
    await loginRevenueCat(USER_ID, EMAIL);

    expect(mockPurchases.logIn).toHaveBeenCalledWith(USER_ID);
    expect(mockPurchases.setEmail).toHaveBeenCalledTimes(1);
    expect(mockPurchases.setEmail).toHaveBeenCalledWith(EMAIL);
    const logInOrder = mockPurchases.logIn.mock.invocationCallOrder[0];
    const setEmailOrder = mockPurchases.setEmail.mock.invocationCallOrder[0];
    expect(logInOrder).toBeLessThan(setEmailOrder);
  });

  it('skips setEmail when the session has no email', async () => {
    await loginRevenueCat(USER_ID, undefined);

    expect(mockPurchases.logIn).toHaveBeenCalledWith(USER_ID);
    expect(mockPurchases.setEmail).not.toHaveBeenCalled();
  });

  // Issue 365 T15: a held null session flushed by a different user's session
  // calls logout and login in the same tick. The old user's logOut must land
  // before the new user's logIn, or the new rider ends on an anonymous customer.
  it('runs a same-tick logout before the next login, in call order', async () => {
    mockIsAnonymous.mockResolvedValue(false);
    mockLogOut.mockResolvedValue({ entitlements: { active: {} } });

    await Promise.all([logoutRevenueCat(), loginRevenueCat('user-2')]);

    expect(mockLogOut).toHaveBeenCalledTimes(1);
    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-2');
    expect(mockLogOut.mock.invocationCallOrder[0]).toBeLessThan(
      mockPurchases.logIn.mock.invocationCallOrder[0],
    );
  });

  it('does not let a hung logout block the next login for good', async () => {
    jest.useFakeTimers();
    let finishLogOut: () => void = () => {};
    mockIsAnonymous.mockResolvedValue(false);
    mockLogOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLogOut = resolve;
        }),
    );
    try {
      const logout = logoutRevenueCat();
      const login = loginRevenueCat('user-3');
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(mockPurchases.logIn).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(10_000);
      await login;
      expect(mockPurchases.logIn).toHaveBeenCalledWith('user-3');

      finishLogOut();
      await logout;
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports a setEmail failure and does not throw', async () => {
    const error = new Error('setEmail failed');
    mockPurchases.setEmail.mockRejectedValueOnce(error);

    await expect(loginRevenueCat(USER_ID, EMAIL)).resolves.toBeUndefined();

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      source: 'revenuecat.setEmail',
    });
  });
});

describe('setOnboardingAttributes', () => {
  it('maps onboarding answers to RevenueCat attributes', async () => {
    await setOnboardingAttributes({
      primaryGoal: 'track_rides',
      bikeMake: 'BMW',
      bikeModel: 'R1250GS',
      bikeYear: 2023,
      experience: 'advanced',
    });

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
      primary_goal: 'track_rides',
      primary_bike_make: 'BMW',
      primary_bike_model: 'R1250GS',
      primary_bike_year: '2023',
      riding_experience: 'advanced',
    });
    expect(mockPurchases.syncAttributesAndOfferingsIfNeeded).toHaveBeenCalled();
  });

  it('sends null for empty / missing answers so attributes are deleted', async () => {
    await setOnboardingAttributes({
      primaryGoal: 'just_exploring',
      bikeMake: '   ',
      bikeModel: undefined,
      bikeYear: null,
    });

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
      primary_goal: 'just_exploring',
      primary_bike_make: null,
      primary_bike_model: null,
      primary_bike_year: null,
      riding_experience: null,
    });
  });

  it('returns early in Expo Go without touching the SDK', async () => {
    const Constants = require('expo-constants');
    Constants.appOwnership = 'expo';

    await setOnboardingAttributes({ primaryGoal: 'track_rides' });

    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();

    Constants.appOwnership = null;
  });

  it('downgrades transient network errors to warn + breadcrumb (no Sentry capture)', async () => {
    const error = new Error('Error performing request');
    mockPurchases.setAttributes.mockRejectedValueOnce(error);

    await setOnboardingAttributes({ primaryGoal: 'track_rides' });

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      'Error performing request',
      'revenuecat.setOnboardingAttributes',
    );
  });

  it('captures genuinely unexpected (non-network) errors to Sentry', async () => {
    const error = new Error('Something unexpected exploded');
    mockPurchases.setAttributes.mockRejectedValueOnce(error);

    await setOnboardingAttributes({ primaryGoal: 'track_rides' });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      source: 'revenuecat.setOnboardingAttributes',
    });
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  it('never throws even when the SDK rejects', async () => {
    mockPurchases.setAttributes.mockRejectedValueOnce(new Error('Error performing request'));

    await expect(setOnboardingAttributes({ primaryGoal: 'track_rides' })).resolves.toBeUndefined();
  });
});

describe('setSelfReportedSource', () => {
  it('writes the self-reported channel as a custom (mutable) attribute', async () => {
    await setSelfReportedSource('tiktok');
    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({ self_reported_source: 'tiktok' });
  });

  it('is a no-op for empty / null values (no write)', async () => {
    await setSelfReportedSource('   ');
    await setSelfReportedSource(null);
    await setSelfReportedSource(undefined);
    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });
});

describe('configureRcAttribution', () => {
  it('does nothing when analytics consent is not granted (GDPR gate)', async () => {
    mockConsent.mockReturnValue(false);

    await configureRcAttribution();

    expect(mockPurchases.collectDeviceIdentifiers).not.toHaveBeenCalled();
    expect(mockPurchases.enableAdServicesAttributionTokenCollection).not.toHaveBeenCalled();
    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });

  it('collects device identifiers + ASA token when consented, even with no UTM', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue(null);

    await configureRcAttribution();

    expect(mockPurchases.collectDeviceIdentifiers).toHaveBeenCalledTimes(1);
    // iOS — ASA token collection enabled.
    expect(mockPurchases.enableAdServicesAttributionTokenCollection).toHaveBeenCalledTimes(1);
    // No real UTM → $mediaSource must NOT be set (write-once guard, KTD-5).
    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });

  it('stamps $mediaSource/$campaign from a real deep-link UTM', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue({ utm_source: 'tiktok', utm_campaign: 'spring' });

    await configureRcAttribution();

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
      $mediaSource: 'tiktok',
      $campaign: 'spring',
    });
  });

  it('never sets $mediaSource for organic_unknown (write-once guard)', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue({ utm_source: 'organic_unknown' });

    await configureRcAttribution();

    expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
  });

  it('omits $campaign when only utm_source is present', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue({ utm_source: 'instagram' });

    await configureRcAttribution();

    expect(mockPurchases.setAttributes).toHaveBeenCalledWith({ $mediaSource: 'instagram' });
  });

  it('downgrades transient network errors to warn + breadcrumb (no Sentry capture)', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue(null);
    mockPurchases.collectDeviceIdentifiers.mockRejectedValueOnce(
      new Error('Error performing request'),
    );

    await configureRcAttribution();

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      'Error performing request',
      'revenuecat.configureRcAttribution',
    );
  });

  it('captures unexpected (non-network) attribution errors to Sentry', async () => {
    mockConsent.mockReturnValue(true);
    mockGetStoredUtm.mockResolvedValue(null);
    mockPurchases.collectDeviceIdentifiers.mockRejectedValueOnce(new Error('boom'));

    await configureRcAttribution();

    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      source: 'revenuecat.configureRcAttribution',
    });
  });

  // NOTE: the Android path (enableAdServicesAttributionTokenCollection skipped) is
  // not unit-tested because babel-preset-expo inlines `process.env.EXPO_OS` at
  // transform time, so it cannot be flipped to 'android' at runtime in jest.
});

// issue 365 T05a: every paywall event says who started it, under which gate policy,
// and where it sits in the session (FS-PO3).
describe('paywall trigger and session properties', () => {
  const PAYWALL_EVENTS = ['PAYWALL_PRESENT_REQUESTED', 'PAYWALL_VIEWED', 'PAYWALL_RESULT'];
  const BASE_KEYS = [
    'source',
    'feature',
    'surface',
    'placement',
    'offering_identifier',
    'required_entitlement_identifier',
    'platform',
    'sdk',
  ];
  const ADDED_KEYS = [
    'trigger',
    'gate_policy',
    'session_paywall_index',
    'minutes_since_onboarding_completed',
  ];
  const MINUTE = 60 * 1000;
  const appStateHandlers: Array<(state: AppStateStatus) => void> = [];
  let now = 0;

  const paywallEvents = () =>
    mockTrackEvent.mock.calls
      .filter(([event]) => PAYWALL_EVENTS.includes(event as string))
      .map(([event, props]) => ({
        event: event as string,
        props: props as Record<string, unknown>,
      }));
  const eventsNamed = (name: string) =>
    paywallEvents()
      .filter(({ event }) => event === name)
      .map(({ props }) => props);
  const changeAppState = (state: AppStateStatus) => {
    for (const handler of appStateHandlers) handler(state);
  };

  beforeAll(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      appStateHandlers.push(handler as (state: AppStateStatus) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    paywallHistoryLoader.load = () =>
      Promise.resolve({
        recordOnboardingPaywallDismissed: jest.fn(),
        getOnboardingPaywallDismissedAt: () => null,
      });
  });

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockPresentPaywallUI.mockResolvedValue('CANCELLED');
    resetPaywallSession();
  });

  afterEach(() => {
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('puts trigger and gate_policy on 100% of paywall events, auto and none by default', async () => {
    await presentPaywall({ source: 'garage', feature: 'unlimited_bikes' });
    mockPresentPaywallUI.mockResolvedValueOnce('PURCHASED');
    await presentPaywall({ source: 'garage', feature: 'unlimited_bikes' });

    const events = paywallEvents();
    expect(events.map(({ event }) => event)).toEqual([...PAYWALL_EVENTS, ...PAYWALL_EVENTS]);
    for (const { props } of events) {
      expect(props).toEqual(
        expect.objectContaining({
          trigger: PAYWALL_TRIGGER.AUTO,
          gate_policy: PAYWALL_GATE_POLICY.NONE,
          minutes_since_onboarding_completed: null,
        }),
      );
    }
  });

  it('numbers each present in the session: Garage "Add a Bike" twice gives 1 then 2', async () => {
    const garage = {
      source: 'garage',
      feature: 'unlimited_bikes',
      surface: 'garage_add_bike_header',
    };
    await presentPaywall(garage);
    await presentPaywall(garage);

    expect(eventsNamed('PAYWALL_PRESENT_REQUESTED')).toEqual([
      expect.objectContaining({ trigger: 'auto', session_paywall_index: 1 }),
      expect.objectContaining({ trigger: 'auto', session_paywall_index: 2 }),
    ]);
    // One present: its viewed and result events share the request's index.
    expect(eventsNamed('PAYWALL_VIEWED').map((p) => p.session_paywall_index)).toEqual([1, 2]);
    expect(eventsNamed('PAYWALL_RESULT').map((p) => p.session_paywall_index)).toEqual([1, 2]);
  });

  it('names the T21 gate events as the shared contract does', () => {
    expect(PAYWALL_GATE_EVENT).toEqual({
      PAYWALL_SUPPRESSED: 'paywall_suppressed',
      LIMIT_SHEET_VIEWED: 'limit_sheet_viewed',
    });
    expect(Object.values(PAYWALL_SUPPRESSED_REASON)).toEqual([
      'feature_cap',
      'session_cap',
      'error_cooldown',
    ]);
  });

  it('keeps the stamped props when call-site metadata uses the same keys', async () => {
    await presentPaywall({
      source: 'feature_gate',
      metadata: {
        entry_surface: 'home',
        trigger: 'rider_tap',
        gate_policy: 'capped_v1',
        session_paywall_index: 99,
        minutes_since_onboarding_completed: 5,
      },
    });

    expect(paywallEvents()).toHaveLength(PAYWALL_EVENTS.length);
    for (const { props } of paywallEvents()) {
      expect(props).toEqual(
        expect.objectContaining({
          entry_surface: 'home',
          trigger: PAYWALL_TRIGGER.AUTO,
          gate_policy: PAYWALL_GATE_POLICY.NONE,
          session_paywall_index: 1,
          minutes_since_onboarding_completed: null,
        }),
      );
    }
  });

  it('carries rider_tap from an explicit Upgrade surface', async () => {
    await presentPaywall({
      source: 'profile',
      feature: 'subscription',
      surface: 'profile_subscriptions_row',
      trigger: PAYWALL_TRIGGER.RIDER_TAP,
    });

    expect(paywallEvents()).toHaveLength(PAYWALL_EVENTS.length);
    for (const { props } of paywallEvents()) {
      expect(props.trigger).toBe('rider_tap');
    }
  });

  it('starts a new session after more than 30 minutes in the background, not after less', async () => {
    await presentPaywall();
    changeAppState('background');
    now += PAYWALL_SESSION_BACKGROUND_RESET_MS;
    changeAppState('active');
    await presentPaywall();
    changeAppState('background');
    now += PAYWALL_SESSION_BACKGROUND_RESET_MS + 1;
    changeAppState('active');
    await presentPaywall();

    expect(eventsNamed('PAYWALL_PRESENT_REQUESTED').map((p) => p.session_paywall_index)).toEqual([
      1, 2, 1,
    ]);
  });

  it('reports whole minutes since onboarding was completed in this app run', async () => {
    recordOnboardingCompleted(now);
    now += 7 * MINUTE + 59 * 1000;

    await presentPaywall();

    expect(paywallEvents()).toHaveLength(PAYWALL_EVENTS.length);
    for (const { props } of paywallEvents()) {
      expect(props.minutes_since_onboarding_completed).toBe(7);
    }
  });

  it('changes onboarding paywall events only by the added properties', async () => {
    await presentPaywall({
      source: 'onboarding',
      feature: 'onboarding',
      surface: ONBOARDING_PAYWALL_SURFACE.STEP,
      placement: 'onboarding',
      silentOnError: true,
    });

    expect(
      paywallEvents().map(({ event, props }) => ({ event, keys: Object.keys(props) })),
    ).toEqual([
      { event: 'PAYWALL_PRESENT_REQUESTED', keys: [...BASE_KEYS, ...ADDED_KEYS] },
      {
        event: 'PAYWALL_VIEWED',
        keys: [
          ...BASE_KEYS,
          ...ADDED_KEYS,
          'offering_source',
          'resolved_offering_identifier',
          'custom_variables_sent',
        ],
      },
      {
        event: 'PAYWALL_RESULT',
        keys: [...BASE_KEYS, ...ADDED_KEYS, 'paywall_result', 'offering_source'],
      },
    ]);
    expect(eventsNamed('PAYWALL_VIEWED')[0]).toEqual(
      expect.objectContaining({
        source: 'onboarding',
        surface: 'onboarding_paywall',
        placement: 'onboarding',
        trigger: 'auto',
        gate_policy: 'none',
        session_paywall_index: 1,
      }),
    );
  });
});
