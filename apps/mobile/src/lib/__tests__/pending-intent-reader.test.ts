import * as SecureStore from 'expo-secure-store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import * as analytics from '../analytics';
import { resolvePendingIntent } from '../pending-intent-reader';

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

const mockSecureStore = jest.mocked(SecureStore);
const mockAnalytics = jest.mocked(analytics);

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  mockSecureStore.getItemAsync.mockResolvedValue(null);
  mockSecureStore.setItemAsync.mockResolvedValue(undefined);
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
    // One-shot flag still written so it never re-runs.
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
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
});
