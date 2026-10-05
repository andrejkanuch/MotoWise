// The launch-time consent enforcement in analytics.ts only runs in a release
// build with a PostHog key, so this suite loads the module with both set.
// It pins the behaviour that keeps an opt-in rider's events off before they
// answer: `defaultOptIn` for a fresh install, and the re-apply once PostHog's
// persisted storage has loaded (which would otherwise keep an old opt-in).

const mockOptIn = jest.fn();
const mockOptOut = jest.fn();
let mockConstructorOptions: Record<string, unknown> = {};
let mockPersistedOptedOut = false;
let mockResolveReady: () => void = () => {};
let mockLaunchState = 'undecided';

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class PostHogMock {
    constructor(_key: string, options: Record<string, unknown>) {
      mockConstructorOptions = options;
    }
    get optedOut() {
      return mockPersistedOptedOut;
    }
    ready = () =>
      new Promise<void>((resolve) => {
        mockResolveReady = resolve;
      });
    optIn = () => mockOptIn();
    optOut = () => mockOptOut();
    capture = jest.fn();
    startSessionRecording = jest.fn();
    stopSessionRecording = jest.fn();
    getDistinctId = () => 'anon-1';
  },
}));

jest.mock('@sentry/react-native', () => ({
  reactNavigationIntegration: jest.fn(() => ({})),
  wrap: jest.fn((c: unknown) => c),
}));

jest.mock('react-native-fbsdk-next', () => ({
  Settings: { setAdvertiserTrackingEnabled: jest.fn() },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { posthogApiKey: 'phc_test', posthogHost: 'https://eu.i.posthog.com' } },
  },
}));

jest.mock('../analytics-consent', () => ({
  CONSENT_STATE: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDECIDED: 'undecided',
    UNKNOWN: 'unknown',
  },
  resolveLaunchConsent: () => mockLaunchState,
  getStoredAnalyticsConsent: () => mockLaunchState === 'granted',
  setStoredAnalyticsConsent: jest.fn(),
}));

jest.mock('../meta-attribution', () => ({
  __esModule: true,
  getStoredUtmProperties: jest.fn().mockResolvedValue(null),
  captureMetaAttribution: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../subscription', () => ({
  __esModule: true,
  configureRcAttribution: jest.fn().mockResolvedValue(undefined),
  stampAnonymousPosthogId: jest.fn().mockResolvedValue(undefined),
}));

type Analytics = typeof import('../analytics');

/** Load analytics.ts fresh, as a release build, for one launch state. */
function launch(state: string, persistedOptedOut = false): Analytics {
  mockLaunchState = state;
  mockPersistedOptedOut = persistedOptedOut;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = false;
  let mod: Analytics | undefined;
  try {
    jest.isolateModules(() => {
      mod = require('../analytics');
    });
  } finally {
    globals.__DEV__ = previousDev;
  }
  if (!mod) throw new Error('analytics did not load');
  return mod;
}

/** Let PostHog's storage "finish loading" and the re-apply run. */
async function storageReady() {
  mockResolveReady();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('launch consent enforcement (release build)', () => {
  it('starts a granted install opted in and re-applies opt-in once storage loads', async () => {
    const analytics = launch('granted');
    expect(mockConstructorOptions.defaultOptIn).toBe(true);
    expect(analytics.isAnalyticsEnabled()).toBe(true);

    await storageReady();
    expect(mockOptIn).toHaveBeenCalledTimes(1);
    expect(mockOptOut).not.toHaveBeenCalled();
  });

  it.each([
    'undecided',
    'denied',
  ])('keeps a %s rider opted out, even over an old persisted opt-in', async (state) => {
    const analytics = launch(state, /* persistedOptedOut */ false);
    expect(mockConstructorOptions.defaultOptIn).toBe(false);
    expect(analytics.isAnalyticsEnabled()).toBe(false);

    await storageReady();
    expect(mockOptOut).toHaveBeenCalledTimes(1);
    expect(mockOptIn).not.toHaveBeenCalled();
  });

  it('follows the persisted opt state when the keychain was unreadable', async () => {
    const analytics = launch('unknown', /* persistedOptedOut */ true);
    expect(analytics.isAnalyticsEnabled()).toBe(false);

    await storageReady();
    expect(mockOptIn).not.toHaveBeenCalled();
    expect(mockOptOut).not.toHaveBeenCalled();
    expect(analytics.isAnalyticsEnabled()).toBe(false);
  });

  it('lets an answer given before storage loads win over the launch state', async () => {
    const analytics = launch('undecided');
    analytics.setAnalyticsEnabled(true);
    mockOptIn.mockClear();

    await storageReady();
    expect(mockOptOut).not.toHaveBeenCalled();
    expect(analytics.isAnalyticsEnabled()).toBe(true);
  });

  // An install opted in under the old model keeps that opt-in persisted until
  // the re-apply runs; the SDK captures lifecycle events before then.
  it('drops anything captured before consent through before_send', () => {
    launch('undecided', /* persistedOptedOut */ false);
    const beforeSend = mockConstructorOptions.before_send as (e: unknown) => unknown;
    expect(beforeSend({ event: 'Application Updated' })).toBeNull();
  });

  it('passes events once consent is granted', () => {
    const analytics = launch('undecided');
    const beforeSend = mockConstructorOptions.before_send as (e: unknown) => unknown;
    analytics.setAnalyticsEnabled(true);
    expect(beforeSend({ event: 'screen' })).toEqual({ event: 'screen' });
  });
});
