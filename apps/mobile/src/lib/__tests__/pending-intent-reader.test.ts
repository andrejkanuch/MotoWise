import * as SecureStore from 'expo-secure-store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import * as analytics from '../analytics';
import { resolvePendingIntent } from '../pending-intent-reader';
import { SECURE_STORE_KEY } from '../secure-store';

// jest.mock is hoisted above these imports by babel-jest, so the imports above
// receive the mocked modules. The reader imports the store (to set pendingIntent)
// — mirror onboarding-store.test.ts.
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
  AFTER_FIRST_UNLOCK: 1,
  WHEN_UNLOCKED: 5,
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../analytics', () => ({
  AnalyticsEvent: { PENDING_INTENT_RESOLVED: 'pending_intent_resolved' },
  trackEvent: jest.fn(),
  setUserPropertiesOnce: jest.fn(),
  registerSuperProperties: jest.fn(),
  captureException: jest.fn(),
}));

const mockSecureStore = jest.mocked(SecureStore);
const mockAnalytics = jest.mocked(analytics);

/** The exact error iOS raises for a keychain read on a locked device. */
const LOCKED_ERROR = new Error(
  "FunctionCallException: Calling the 'getValueWithKeyAsync' function has failed " +
    '(at ExpoModulesCore/AsyncFunctionDefinition.swift:123)\n' +
    '→ Caused by: KeyChainException: User interaction is not allowed. ' +
    '(at ExpoSecureStore/SecureStoreModule.swift:168)',
);

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  mockSecureStore.getItemAsync.mockResolvedValue(null);
  mockSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
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
    expect(mockAnalytics.trackEvent).not.toHaveBeenCalled();
    // One-shot flag still written so it never re-runs — with AFTER_FIRST_UNLOCK
    // so a background cold start can read it back on a locked device.
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_STORE_KEY.PENDING_INTENT_CHECKED,
      '1',
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
    );
  });

  it('is a one-shot: does nothing when already checked', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('1');

    await resolvePendingIntent();

    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('secure store unavailable'));
    await expect(resolvePendingIntent()).resolves.toBeUndefined();
  });

  // MOTO-VAULT-REACT-NATIVE-2D: this ran from a background cold start
  // (`in_foreground: false`) and the locked keychain threw, which was reported
  // to Sentry as an error 124 times across 18 riders.
  it('treats a locked keychain as expected: no Sentry report, one-shot not burned', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(LOCKED_ERROR);

    await resolvePendingIntent();

    expect(mockAnalytics.captureException).not.toHaveBeenCalled();
    // The flag must NOT be written — the read never told us whether the
    // transport was already consumed, so resolution is retried when unlocked.
    expect(mockSecureStore.setItemAsync).not.toHaveBeenCalledWith(
      SECURE_STORE_KEY.PENDING_INTENT_CHECKED,
      expect.anything(),
      expect.anything(),
    );
    // Onboarding is never blocked on the outcome.
    expect(useOnboardingStore.getState().intentResolved).toBe(true);
  });
});
