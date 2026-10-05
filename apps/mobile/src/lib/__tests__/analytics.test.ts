// Mock the analytics module graph so analytics.ts can load in isolation.
const mockCapture = jest.fn();

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class PostHogMock {
    capture = (...args: unknown[]) => mockCapture(...args);
    identify = () => {};
    optIn = () => {};
    optOut = () => {};
    startSessionRecording = () => {};
    stopSessionRecording = () => {};
    getDistinctId = () => 'anon-1';
    screen = () => {};
    flush = async () => {};
    reset = () => {};
  },
}));

jest.mock('@sentry/react-native', () => ({
  reactNavigationIntegration: jest.fn(() => ({})),
  mobileReplayIntegration: jest.fn(() => ({})),
  hermesProfilingIntegration: jest.fn(() => ({})),
  stallTrackingIntegration: jest.fn(() => ({})),
  spotlightIntegration: jest.fn(() => ({})),
  wrap: jest.fn((c: unknown) => c),
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  flush: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('react-native-fbsdk-next', () => ({
  Settings: { setAdvertiserTrackingEnabled: jest.fn() },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { posthogApiKey: '', posthogHost: 'https://eu.i.posthog.com' } },
  },
}));

const mockSetStoredConsent = jest.fn();
jest.mock('../analytics-consent', () => ({
  CONSENT_STATE: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDECIDED: 'undecided',
    UNKNOWN: 'unknown',
  },
  resolveLaunchConsent: jest.fn(() => 'undecided'),
  getStoredAnalyticsConsent: jest.fn(() => false),
  setStoredAnalyticsConsent: (...a: unknown[]) => mockSetStoredConsent(...a),
}));

jest.mock('../meta-attribution', () => ({
  __esModule: true,
  getStoredUtmProperties: jest.fn().mockResolvedValue(null),
  captureMetaAttribution: jest.fn().mockResolvedValue(undefined),
}));

const mockConfigureRcAttribution = jest.fn().mockResolvedValue(undefined);
jest.mock('../subscription', () => ({
  __esModule: true,
  configureRcAttribution: () => mockConfigureRcAttribution(),
}));

import {
  AnalyticsEvent,
  sentryBeforeSend,
  setAnalyticsEnabled,
  setUserProperties,
  setUserPropertiesOnce,
  trackEvent,
} from '../analytics';

beforeEach(() => {
  jest.clearAllMocks();
  setAnalyticsEnabled(true); // reset module state to enabled
  mockCapture.mockClear();
});

describe('trackEvent', () => {
  it('captures the event once — no Meta-named alias duplicate goes to PostHog', () => {
    trackEvent(AnalyticsEvent.DIAGNOSTIC_STARTED, { source: 'test' });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('diagnostic_started', { source: 'test' });
  });
});

describe('setUserPropertiesOnce', () => {
  it('captures a $set_once payload (NOT $set) so first-touch props are immutable', () => {
    setUserPropertiesOnce({ heard_from: 'tiktok' });

    expect(mockCapture).toHaveBeenCalledWith('$set', { $set_once: { heard_from: 'tiktok' } });
    // Guard against a $set/$set_once mix-up that would silently break first-touch.
    expect(setUserProperties).not.toBe(setUserPropertiesOnce);
  });

  it('is a no-op when analytics is disabled', () => {
    setAnalyticsEnabled(false);
    mockCapture.mockClear();

    setUserPropertiesOnce({ heard_from: 'instagram' });

    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe('sentryBeforeSend', () => {
  // Minimal shape of Sentry.ErrorEvent that beforeSend reads.
  const eventWithMessage = (value: string) =>
    ({ exception: { values: [{ type: 'Error', value }] } }) as Parameters<
      typeof sentryBeforeSend
    >[0];

  it.each([
    'fetch failed: The Internet connection appears to be offline.',
    'fetch failed: cancelled',
    'fetch failed: La connexion réseau a été perdue.',
    'The Internet connection appears to be offline.',
    'Error performing request.',
  ])('drops transport-failure event %j (MOTO-VAULT-REACT-NATIVE-22/-23/-26/-1Y)', (msg) => {
    expect(sentryBeforeSend(eventWithMessage(msg))).toBeNull();
  });

  it('passes genuine application errors through', () => {
    const event = eventWithMessage('Cannot read property of undefined');
    expect(sentryBeforeSend(event)).toBe(event);
  });
});

describe('setAnalyticsEnabled consent persistence (KTD-9)', () => {
  // NOTE: setAnalyticsEnabled(true) ALSO lazy-imports ./subscription + ./meta-attribution
  // to re-wire attribution on opt-in. That dynamic-import side effect is not observable
  // in jest-expo's module runtime, so it isn't asserted here; the wired targets
  // (configureRcAttribution / captureMetaAttribution) are unit-tested directly in
  // subscription.test.ts and meta-attribution.test.ts. This test pins the deterministic,
  // synchronous contract: consent is persisted so the gates inside those targets pass.
  it('persists consent synchronously so opt-in unblocks the attribution gates', () => {
    setAnalyticsEnabled(true);
    // decidedAt defaults to "now" inside setStoredAnalyticsConsent.
    expect(mockSetStoredConsent).toHaveBeenLastCalledWith(true, undefined);
  });

  it('persists a decision taken over from the account with its own timestamp', () => {
    setAnalyticsEnabled(true, 1234);
    expect(mockSetStoredConsent).toHaveBeenLastCalledWith(true, 1234);
  });

  it('persists withdrawal synchronously', () => {
    setAnalyticsEnabled(false);
    expect(mockSetStoredConsent).toHaveBeenLastCalledWith(false, undefined);
  });
});
