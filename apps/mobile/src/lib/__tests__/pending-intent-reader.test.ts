// Store deps (transitive via ../pending-intent) — mirror onboarding-store.test.ts.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../graphql-client', () => ({
  gqlFetcher: jest.fn(),
}));

// One analytics mock serves both the reader and the store's captureException.
jest.mock('../analytics', () => ({
  AnalyticsEvent: { PENDING_INTENT_RESOLVED: 'pending_intent_resolved' },
  trackEvent: jest.fn(),
  setUserPropertiesOnce: jest.fn(),
  registerSuperProperties: jest.fn(),
  captureException: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Clipboard = require('expo-clipboard');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { gqlFetcher } = require('../graphql-client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const analytics = require('../analytics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolvePendingIntent } = require('../pending-intent-reader');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOnboardingStore } = require('../../stores/onboarding.store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { INTENT_TOKEN_SCHEME } = require('../pending-intent');

const MAKES = [
  { makeId: 483, makeName: 'Yamaha' },
  { makeId: 474, makeName: 'Honda' },
];

const token = (params: string) => `${INTENT_TOKEN_SCHEME}?${params}`;
const freshToken = (extra = '') =>
  token(
    `mv_make=Yamaha&mv_model=MT-07&utm_source=blog&utm_campaign=blog_maintenance&ts=${Date.now()}${extra}`,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  SecureStore.getItemAsync.mockResolvedValue(null);
  SecureStore.setItemAsync.mockResolvedValue(undefined);
  gqlFetcher.mockResolvedValue({ motorcycleMakes: MAKES });
  Clipboard.setStringAsync.mockResolvedValue(undefined);
});

// NOTE: jest-expo inlines `process.env.EXPO_OS` (defaults to 'ios') at transform
// time, so the platform branch cannot be flipped at runtime here — these cover
// the iOS clipboard path. The Android install-referrer path (and its guarded
// no-op when the native module is absent) is verified on-device in T2.
describe('resolvePendingIntent — iOS (clipboard)', () => {
  it('seeds the store, clears the clipboard, flags checked, and fires analytics', async () => {
    Clipboard.getStringAsync.mockResolvedValue(freshToken());

    await resolvePendingIntent();

    const { bikeData, pendingIntent } = useOnboardingStore.getState();
    expect(bikeData).toMatchObject({ make: 'Yamaha', makeId: 483, model: 'MT-07' });
    expect(pendingIntent).toMatchObject({ make: 'Yamaha', source: 'blog' });

    // Our own token is cleared.
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('');
    // One-shot flag written.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
    // Analytics: event + person props + cohort super-property.
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'pending_intent_resolved',
      expect.objectContaining({ make: 'Yamaha', method: 'clipboard', matched: true }),
    );
    expect(analytics.setUserPropertiesOnce).toHaveBeenCalledWith(
      expect.objectContaining({ intent_make: 'Yamaha' }),
    );
    expect(analytics.registerSuperProperties).toHaveBeenCalledWith({
      intent_cohort: 'maintenance',
    });
  });

  it('does NOT touch a clipboard that is not our token (no clear, no seed)', async () => {
    Clipboard.getStringAsync.mockResolvedValue('just some copied text');

    await resolvePendingIntent();

    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().bikeData).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    // Still flags checked — the transport was read; nothing to retry.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
  });

  it('ignores an expired token (clears it, but no seed / no event)', async () => {
    Clipboard.getStringAsync.mockResolvedValue(
      token(`mv_make=Yamaha&mv_model=MT-07&ts=${Date.now() - 2 * 60 * 60 * 1000}`),
    );

    await resolvePendingIntent();

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(''); // was our token → cleared
    expect(useOnboardingStore.getState().bikeData).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('fires matched:false and does not seed when the make is unknown', async () => {
    Clipboard.getStringAsync.mockResolvedValue(token(`mv_make=Peugeot&ts=${Date.now()}`));

    await resolvePendingIntent();

    expect(useOnboardingStore.getState().bikeData).toBeNull();
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'pending_intent_resolved',
      expect.objectContaining({ make: 'Peugeot', matched: false }),
    );
  });

  it('is a one-shot: does nothing when already checked', async () => {
    SecureStore.getItemAsync.mockResolvedValue('1');

    await resolvePendingIntent();

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().bikeData).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('does not seed if the make list fails to load (fail-open)', async () => {
    Clipboard.getStringAsync.mockResolvedValue(freshToken());
    gqlFetcher.mockRejectedValue(new Error('network down'));

    await resolvePendingIntent();

    expect(useOnboardingStore.getState().bikeData).toBeNull();
    // Intent was still resolved — event fires with matched:false.
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'pending_intent_resolved',
      expect.objectContaining({ matched: false }),
    );
  });
});
