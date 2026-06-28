// In-memory SecureStore + controllable mocks shared across module resets.
const mockStore = new Map<string, string>();
const mockCapture = jest.fn();
const mockGetInitialURL = jest.fn<Promise<string | null>, []>();
let mockAnalyticsEnabled = true;
let mockConsent = true;

jest.mock('../analytics', () => ({
  posthogClient: { capture: (...args: unknown[]) => mockCapture(...args) },
  isAnalyticsEnabled: () => mockAnalyticsEnabled,
}));

jest.mock('../analytics-consent', () => ({
  getStoredAnalyticsConsent: () => mockConsent,
}));

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '9.9.9' } },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null),
  setItemAsync: (k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  },
  deleteItemAsync: (k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  },
}));

type MetaAttribution = typeof import('../meta-attribution');
function loadModule(): MetaAttribution {
  let mod: MetaAttribution;
  jest.isolateModules(() => {
    mod = require('../meta-attribution');
  });
  // biome-ignore lint/style/noNonNullAssertion: assigned synchronously above
  return mod!;
}

beforeAll(() => {
  process.env.EXPO_OS = 'ios';
});

beforeEach(() => {
  mockStore.clear();
  mockCapture.mockClear();
  mockGetInitialURL.mockReset();
  mockAnalyticsEnabled = true;
  mockConsent = true;
});

describe('captureMetaAttribution', () => {
  it('emits organic install attribution on a first launch with no deep link', async () => {
    mockGetInitialURL.mockResolvedValue(null);
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [event, payload] = mockCapture.mock.calls[0];
    expect(event).toBe('install_attribution_captured');
    expect(payload.$set_once).toMatchObject({
      install_source: 'organic_unknown',
      install_platform: 'ios',
      install_version: '9.9.9',
    });
    expect(payload.$set_once.first_seen_at).toEqual(expect.any(String));
    // CAPTURED flag set so it never re-fires.
    expect(mockStore.get('meta_captured')).toBe('1');
  });

  it('on opt-in retry, emits the ORIGINAL pre-consent utm_source and persisted first_seen_at (not organic/now)', async () => {
    // First launch: consent OFF, a tagged link — UTM + first_seen_at persisted, no emit.
    mockConsent = false;
    mockGetInitialURL.mockResolvedValue('motovault://open?utm_source=tiktok');
    const first = loadModule();
    await first.captureMetaAttribution();
    expect(mockCapture).not.toHaveBeenCalled();
    const persistedFirstSeen = mockStore.get('meta_first_seen_at');
    expect(persistedFirstSeen).toEqual(expect.any(String));

    // Later launch: consent now ON, no deep link (cold organic open) — must still
    // attribute to tiktok via the persisted UTM, and reuse the original timestamp.
    mockConsent = true;
    mockGetInitialURL.mockResolvedValue(null);
    const second = loadModule();
    await second.captureMetaAttribution();

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const payload = mockCapture.mock.calls[0][1];
    expect(payload.$set_once.install_source).toBe('tiktok');
    expect(payload.$set_once.first_seen_at).toBe(persistedFirstSeen);
    expect(mockStore.get('meta_captured')).toBe('1');
  });

  it('uses utm_source as install_source even without utm_content, and persists it', async () => {
    mockGetInitialURL.mockResolvedValue('motovault://open?utm_source=tiktok&utm_campaign=spring');
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();

    const payload = mockCapture.mock.calls[0][1];
    expect(payload.$set_once.install_source).toBe('tiktok');
    expect(payload.$set_once.utm_source).toBe('tiktok');
    // Persisted independently of utm_content (KTD-4) so U5 can read it later.
    expect(mockStore.get('meta_utm_source')).toBe('tiktok');
    expect(mockStore.get('meta_utm_campaign')).toBe('spring');
  });

  it('does NOT emit and does NOT set CAPTURED when consent is not granted', async () => {
    mockConsent = false;
    mockGetInitialURL.mockResolvedValue('motovault://open?utm_source=instagram');
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockStore.get('meta_captured')).toBeUndefined();
    // UTM is still persisted on-device for a later consented emit.
    expect(mockStore.get('meta_utm_source')).toBe('instagram');
  });

  it('is idempotent — a second call after CAPTURED does nothing', async () => {
    mockStore.set('meta_captured', '1');
    mockGetInitialURL.mockResolvedValue(null);
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();

    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('does not emit when analytics is disabled', async () => {
    mockAnalyticsEnabled = false;
    mockGetInitialURL.mockResolvedValue(null);
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();

    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe('getStoredUtmProperties', () => {
  it('returns a source-only object (not null) when only utm_source is stored', async () => {
    mockStore.set('meta_utm_source', 'tiktok');
    const { getStoredUtmProperties } = loadModule();

    await expect(getStoredUtmProperties()).resolves.toEqual({ utm_source: 'tiktok' });
  });

  it('returns null when no UTM keys are stored', async () => {
    const { getStoredUtmProperties } = loadModule();
    await expect(getStoredUtmProperties()).resolves.toBeNull();
  });

  it('returns campaign-only and content-only objects (independent of utm_source)', async () => {
    mockStore.set('meta_utm_campaign', 'spring');
    await expect(loadModule().getStoredUtmProperties()).resolves.toEqual({
      utm_campaign: 'spring',
    });

    mockStore.clear();
    mockStore.set('meta_utm_content', 'reel_1');
    await expect(loadModule().getStoredUtmProperties()).resolves.toEqual({ utm_content: 'reel_1' });

    mockStore.clear();
    mockStore.set('meta_utm_source', 'tiktok');
    mockStore.set('meta_utm_campaign', 'spring');
    await expect(loadModule().getStoredUtmProperties()).resolves.toEqual({
      utm_source: 'tiktok',
      utm_campaign: 'spring',
    });
  });
});

describe('captureMetaAttribution dedup + sanitization', () => {
  it('dedups concurrent callers into a single run (getInitialURL read once)', async () => {
    mockGetInitialURL.mockResolvedValue(null);
    const { captureMetaAttribution } = loadModule();

    await Promise.all([captureMetaAttribution(), captureMetaAttribution()]);

    expect(mockGetInitialURL).toHaveBeenCalledTimes(1);
  });

  it('releases the memo after a non-emit run so a later consented call retries', async () => {
    mockConsent = false;
    mockGetInitialURL.mockResolvedValue(null);
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();
    expect(mockCapture).not.toHaveBeenCalled();

    // Consent flips ON within the SAME module instance — the released memo allows a retry.
    mockConsent = true;
    await captureMetaAttribution();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('sanitizes unsafe characters out of utm_source before use', async () => {
    mockGetInitialURL.mockResolvedValue('motovault://open?utm_source=tik!tok');
    const { captureMetaAttribution } = loadModule();

    await captureMetaAttribution();

    expect(mockCapture.mock.calls[0][1].$set_once.install_source).toBe('tiktok');
  });
});
