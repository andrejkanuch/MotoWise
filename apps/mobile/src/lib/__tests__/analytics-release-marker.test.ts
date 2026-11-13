// FS-M (issue 365 T01): every PostHog event carries the release marker, so a fix can
// be read per release even when an OTA keeps `$app_version`. Also pins that
// `platform` is on the very first `Application Opened` after install — it used to
// arrive only once the super-properties hook mounted, so 29% of opens had none.

import type { JsonType } from '@posthog/core';
import { ACTIVATION_FIX_LEVEL } from '../../config/activation';

interface UpdatesMock {
  updateId: string | null;
  isEmbeddedLaunch: boolean;
  channel: string | null;
  runtimeVersion: string | null;
}

const EMBEDDED_LAUNCH: UpdatesMock = {
  // A release build reports the embedded bundle's own id: it is still embedded JS.
  updateId: '0b1c0e7a-0000-4000-8000-000000000001',
  isEmbeddedLaunch: true,
  channel: 'production',
  runtimeVersion: '3.29.0',
};

const OTA_LAUNCH: UpdatesMock = {
  updateId: '7c4f6a2e-1111-4222-8333-444455556666',
  isEmbeddedLaunch: false,
  channel: 'production',
  runtimeVersion: '3.29.0',
};

const MARKER_KEYS = [
  'activation_fix_level',
  'ota_update_id',
  'ota_channel',
  'is_embedded_launch',
  'runtime_version',
  'platform',
  'e2e_run',
] as const;

type ReleaseMarkerModule = typeof import('../analytics-release-marker');

const ORIGINAL_E2E_RUN = process.env.EXPO_PUBLIC_E2E_RUN;

afterEach(() => {
  if (ORIGINAL_E2E_RUN === undefined) delete process.env.EXPO_PUBLIC_E2E_RUN;
  else process.env.EXPO_PUBLIC_E2E_RUN = ORIGINAL_E2E_RUN;
});

/** Load the marker module fresh against one launch's `expo-updates` values. */
function loadMarkerModule(updates: UpdatesMock): ReleaseMarkerModule {
  let mod: ReleaseMarkerModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-updates', () => ({ __esModule: true, ...updates }));
    mod = require('../analytics-release-marker');
  });
  if (!mod) throw new Error('analytics-release-marker did not load');
  return mod;
}

describe('buildReleaseMarker', () => {
  it('marks an embedded launch as embedded, whatever id the embedded bundle has', () => {
    const marker = loadMarkerModule(EMBEDDED_LAUNCH).buildReleaseMarker();
    expect(marker.ota_update_id).toBe('embedded');
    expect(marker.is_embedded_launch).toBe(true);
    expect(marker.runtime_version).toBe('3.29.0');
    expect(marker.ota_channel).toBe('production');
  });

  it('carries the update id on an OTA launch', () => {
    const marker = loadMarkerModule(OTA_LAUNCH).buildReleaseMarker();
    expect(marker.ota_update_id).toBe(OTA_LAUNCH.updateId);
    expect(marker.is_embedded_launch).toBe(false);
  });

  it('reads as embedded when expo-updates reports no id (updates disabled)', () => {
    const marker = loadMarkerModule({
      updateId: null,
      isEmbeddedLaunch: false,
      channel: null,
      runtimeVersion: null,
    }).buildReleaseMarker();
    expect(marker.ota_update_id).toBe('embedded');
    // Unknown values are left out rather than sent as null.
    expect(marker).not.toHaveProperty('ota_channel');
    expect(marker).not.toHaveProperty('runtime_version');
  });

  it('stamps the level from config/activation.ts as an integer', () => {
    const marker = loadMarkerModule(EMBEDDED_LAUNCH).buildReleaseMarker();
    expect(marker.activation_fix_level).toBe(ACTIVATION_FIX_LEVEL);
    expect(Number.isInteger(marker.activation_fix_level)).toBe(true);
  });

  it('always carries the platform', () => {
    const marker = loadMarkerModule(EMBEDDED_LAUNCH).buildReleaseMarker();
    expect(typeof marker.platform).toBe('string');
    expect(marker.platform).not.toBe('');
  });

  it('sets e2e_run only when the E2E build flag is exactly "1"', () => {
    process.env.EXPO_PUBLIC_E2E_RUN = '1';
    expect(loadMarkerModule(EMBEDDED_LAUNCH).buildReleaseMarker().e2e_run).toBe(true);

    for (const value of [undefined, '', '0', 'true']) {
      if (value === undefined) delete process.env.EXPO_PUBLIC_E2E_RUN;
      else process.env.EXPO_PUBLIC_E2E_RUN = value;
      expect(loadMarkerModule(EMBEDDED_LAUNCH).buildReleaseMarker()).not.toHaveProperty('e2e_run');
    }
  });

  it('holds nothing but the release fields (no PII)', () => {
    process.env.EXPO_PUBLIC_E2E_RUN = '1';
    const marker = loadMarkerModule(OTA_LAUNCH).buildReleaseMarker();
    expect(Object.keys(marker).sort()).toEqual([...MARKER_KEYS].sort());
  });
});

// ---- Wiring in lib/analytics.ts (release build, PostHog key set) ----------

const mockRegister = jest.fn();
const mockCapture = jest.fn();
let mockConstructorOptions: Record<string, unknown> = {};
let mockLaunchState = 'undecided';
/** Every call the client received, in order, to prove register precedes capture. */
const mockCallOrder: string[] = [];

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: class PostHogMock {
    constructor(_key: string, options: Record<string, unknown>) {
      mockConstructorOptions = options;
    }
    optedOut = false;
    ready = () => new Promise<void>(() => {});
    register = (props: Record<string, JsonType>) => {
      mockCallOrder.push('register');
      mockRegister(props);
    };
    capture = (...args: unknown[]) => {
      mockCallOrder.push('capture');
      mockCapture(...args);
    };
    optIn = jest.fn();
    optOut = jest.fn();
    reset = jest.fn();
    startSessionRecording = jest.fn();
    stopSessionRecording = jest.fn();
    getDistinctId = () => 'anon-1';
  },
}));

jest.mock('@sentry/react-native', () => ({
  reactNavigationIntegration: jest.fn(() => ({})),
  wrap: jest.fn((c: unknown) => c),
  setUser: jest.fn(),
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

/** Load analytics.ts fresh, as a release build, for one launch consent state. */
function launch(state: string, updates: UpdatesMock = EMBEDDED_LAUNCH): Analytics {
  mockLaunchState = state;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = false;
  let mod: Analytics | undefined;
  try {
    jest.isolateModules(() => {
      jest.doMock('expo-updates', () => ({ __esModule: true, ...updates }));
      mod = require('../analytics');
    });
  } finally {
    globals.__DEV__ = previousDev;
  }
  if (!mod) throw new Error('analytics did not load');
  return mod;
}

function lastRegistered(): Record<string, JsonType> {
  const calls = mockRegister.mock.calls;
  return calls[calls.length - 1]?.[0] ?? {};
}

type BeforeSend = (event: {
  event: string;
  properties?: Record<string, JsonType>;
}) => { event: string; properties?: Record<string, JsonType> } | null;

beforeEach(() => {
  jest.clearAllMocks();
  mockCallOrder.length = 0;
});

describe('release marker wiring (lib/analytics.ts)', () => {
  it.each([
    'granted',
    'undecided',
    'denied',
    'unknown',
  ])('registers the marker right after the client is created (%s launch)', (state) => {
    launch(state);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(lastRegistered()).toMatchObject({
      activation_fix_level: ACTIVATION_FIX_LEVEL,
      ota_update_id: 'embedded',
      is_embedded_launch: true,
      runtime_version: '3.29.0',
      ota_channel: 'production',
    });
    expect(typeof lastRegistered().platform).toBe('string');
  });

  it('registers before anything is captured', () => {
    launch('granted');
    expect(mockCallOrder[0]).toBe('register');
  });

  it('registers the marker again when consent is granted', () => {
    const analytics = launch('undecided');
    mockRegister.mockClear();
    analytics.setAnalyticsEnabled(true);
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        activation_fix_level: ACTIVATION_FIX_LEVEL,
        ota_update_id: 'embedded',
      }),
    );
  });

  it('registers the marker again after sign-out clears super properties', () => {
    const analytics = launch('granted');
    mockRegister.mockClear();
    analytics.resetUser();
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({ activation_fix_level: ACTIVATION_FIX_LEVEL }),
    );
  });

  // The SDK captures `Application Installed`/`Opened` as soon as its storage has
  // loaded, which can be before a queued `register` lands, so the first open is
  // stamped on its way out as well.
  it('stamps the marker and platform on the first Application Opened after install', () => {
    launch('granted', OTA_LAUNCH);
    const beforeSend = mockConstructorOptions.before_send as BeforeSend;
    const sent = beforeSend({
      event: 'Application Opened',
      properties: { $app_version: '3.29.0' },
    });
    expect(sent?.properties).toMatchObject({
      $app_version: '3.29.0',
      activation_fix_level: ACTIVATION_FIX_LEVEL,
      ota_update_id: OTA_LAUNCH.updateId,
      is_embedded_launch: false,
      runtime_version: '3.29.0',
    });
    expect(typeof sent?.properties?.platform).toBe('string');
  });

  it('stamps an event that arrives with no properties at all', () => {
    launch('granted');
    const beforeSend = mockConstructorOptions.before_send as BeforeSend;
    const sent = beforeSend({ event: 'Application Installed' });
    expect(typeof sent?.properties?.platform).toBe('string');
    expect(sent?.properties?.ota_update_id).toBe('embedded');
  });

  it('still drops everything before consent', () => {
    launch('undecided');
    const beforeSend = mockConstructorOptions.before_send as BeforeSend;
    expect(beforeSend({ event: 'Application Opened' })).toBeNull();
  });
});
