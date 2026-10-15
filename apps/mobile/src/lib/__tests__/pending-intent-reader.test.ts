import * as SecureStore from 'expo-secure-store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import * as analytics from '../analytics';
import { resolvePendingIntent } from '../pending-intent-reader';
import * as secureStore from '../secure-store';
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
  addBreadcrumb: jest.fn(),
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

  // MOTO-VAULT-REACT-NATIVE-32 / -3V: the Play Referrer native module can go
  // silent (and a low-end phone's cold start can outlast the bound), so the 4s
  // bound expiring is an expected outcome. It was reported as an Error on every
  // such launch.
  describe('when the read outlasts the bound', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('leaves a breadcrumb instead of a Sentry error and still unblocks onboarding', async () => {
      // A read that never settles — the stalled-transport shape.
      mockSecureStore.getItemAsync.mockReturnValue(new Promise<string | null>(() => {}));

      const resolution = resolvePendingIntent();
      await jest.advanceTimersByTimeAsync(4000);
      await resolution;

      expect(mockAnalytics.captureException).not.toHaveBeenCalled();
      expect(mockAnalytics.addBreadcrumb).toHaveBeenCalledTimes(1);
      expect(useOnboardingStore.getState().intentResolved).toBe(true);
      // Nothing was consumed, so the one-shot stays unwritten for the next launch.
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('still completes a read that lands after the bound', async () => {
      let release: (value: string | null) => void = () => {};
      mockSecureStore.getItemAsync.mockReturnValueOnce(
        new Promise<string | null>((resolve) => {
          release = resolve;
        }),
      );

      const resolution = resolvePendingIntent();
      await jest.advanceTimersByTimeAsync(4000);
      await resolution;
      release(null);
      await jest.advanceTimersByTimeAsync(0);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        SECURE_STORE_KEY.PENDING_INTENT_CHECKED,
        '1',
        { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK },
      );
      expect(mockAnalytics.captureException).not.toHaveBeenCalled();
    });
  });

  it('reports a failure from a foreground retry instead of leaving it unhandled', async () => {
    const failure = new Error('retry blew up');
    let retryTask: () => Promise<boolean> = () => Promise.resolve(true);
    const retry = jest
      .spyOn(secureStore, 'runWithUnlockRetry')
      .mockImplementationOnce(async (task) => {
        // The AppState listener keeps this task and runs it after this resolves.
        retryTask = task;
      });
    await resolvePendingIntent();

    const read = jest.spyOn(secureStore, 'readSecureItem').mockRejectedValueOnce(failure);
    await expect(retryTask()).resolves.toBe(true);

    expect(mockAnalytics.captureException).toHaveBeenCalledWith(failure, {
      source: 'pending-intent-reader.resolvePendingIntent',
    });
    read.mockRestore();
    retry.mockRestore();
  });

  it('still reports a real failure to Sentry', async () => {
    const failure = new Error('resolution blew up');
    const retry = jest.spyOn(secureStore, 'runWithUnlockRetry').mockRejectedValueOnce(failure);

    await expect(resolvePendingIntent()).resolves.toBeUndefined();

    expect(mockAnalytics.captureException).toHaveBeenCalledWith(failure, {
      source: 'pending-intent-reader.resolvePendingIntent',
    });
    expect(mockAnalytics.addBreadcrumb).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().intentResolved).toBe(true);
    retry.mockRestore();
  });
});
