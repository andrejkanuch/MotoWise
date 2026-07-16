// The reader imports the store (to set pendingIntent) — mirror onboarding-store.test.ts.
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

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../analytics', () => ({
  AnalyticsEvent: { PENDING_INTENT_RESOLVED: 'pending_intent_resolved' },
  trackEvent: jest.fn(),
  setUserPropertiesOnce: jest.fn(),
  registerSuperProperties: jest.fn(),
  captureException: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const analytics = require('../analytics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolvePendingIntent } = require('../pending-intent-reader');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOnboardingStore } = require('../../stores/onboarding.store');

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  SecureStore.getItemAsync.mockResolvedValue(null);
  SecureStore.setItemAsync.mockResolvedValue(undefined);
});

// The only intent transport is the Android Play install referrer (via a native
// module). jest-expo inlines `process.env.EXPO_OS` to 'ios', so here the reader
// takes the iOS no-op branch — which is exactly what we assert (no intent, no
// crash, flag set). The referrer PARSE is covered by pending-intent.test.ts and
// the native referrer read is verified on an Android device.
describe('resolvePendingIntent', () => {
  it('is a safe no-op on iOS (no transport): flags checked, no intent, no analytics', async () => {
    await resolvePendingIntent();

    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    // One-shot flag still written so it never re-runs.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
  });

  it('is a one-shot: does nothing when already checked', async () => {
    SecureStore.getItemAsync.mockResolvedValue('1');

    await resolvePendingIntent();

    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    SecureStore.getItemAsync.mockRejectedValue(new Error('secure store unavailable'));
    await expect(resolvePendingIntent()).resolves.toBeUndefined();
  });
});
