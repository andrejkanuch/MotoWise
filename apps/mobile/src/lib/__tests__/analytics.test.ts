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

import { setAnalyticsEnabled, setUserProperties, setUserPropertiesOnce } from '../analytics';

beforeEach(() => {
  jest.clearAllMocks();
  setAnalyticsEnabled(true); // reset module state to enabled
  mockCapture.mockClear();
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

describe('setAnalyticsEnabled consent persistence (KTD-9)', () => {
  // NOTE: setAnalyticsEnabled(true) ALSO lazy-imports ./subscription + ./meta-attribution
  // to re-wire attribution on opt-in. That dynamic-import side effect is not observable
  // in jest-expo's module runtime, so it isn't asserted here; the wired targets
  // (configureRcAttribution / captureMetaAttribution) are unit-tested directly in
  // subscription.test.ts and meta-attribution.test.ts. This test pins the deterministic,
  // synchronous contract: consent is persisted so the gates inside those targets pass.
  it('persists consent synchronously so opt-in unblocks the attribution gates', () => {
    setAnalyticsEnabled(true);
    expect(mockSetStoredConsent).toHaveBeenLastCalledWith(true);
  });

  it('persists withdrawal synchronously', () => {
    setAnalyticsEnabled(false);
    expect(mockSetStoredConsent).toHaveBeenLastCalledWith(false);
  });
});
