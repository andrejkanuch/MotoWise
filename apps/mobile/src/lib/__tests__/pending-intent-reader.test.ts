// Store deps (the reader now imports the store to set pendingIntent) — mirror
// onboarding-store.test.ts.
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
  hasStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
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
const analytics = require('../analytics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolvePendingIntent } = require('../pending-intent-reader');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOnboardingStore } = require('../../stores/onboarding.store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { INTENT_TOKEN_URL_PREFIX } = require('../pending-intent');

const token = (params: string) => `${INTENT_TOKEN_URL_PREFIX}?${params}`;
const freshToken = () =>
  token(
    `mv_make=Yamaha&mv_model=MT-07&utm_source=blog&utm_campaign=blog_maintenance&ts=${Date.now()}`,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  SecureStore.getItemAsync.mockResolvedValue(null);
  SecureStore.setItemAsync.mockResolvedValue(undefined);
  Clipboard.setStringAsync.mockResolvedValue(undefined);
  // Default: the clipboard holds a string, so the reader proceeds to the
  // (prompting) read. The "empty clipboard" case overrides this to false.
  Clipboard.hasStringAsync.mockResolvedValue(true);
});

// The reader stores the RAW pendingIntent only; the make is resolved + the bike
// seeded later in bike-setup (which already loads the make list). So these assert
// pendingIntent, NOT bikeData.
//
// NOTE: jest-expo inlines `process.env.EXPO_OS` (defaults to 'ios') at transform
// time, so the platform branch cannot be flipped at runtime here — these cover
// the iOS clipboard path. The Android install-referrer path is verified on-device.
describe('resolvePendingIntent — iOS (clipboard)', () => {
  it('stores pendingIntent, clears the clipboard, flags checked, and fires analytics', async () => {
    Clipboard.getStringAsync.mockResolvedValue(freshToken());

    await resolvePendingIntent();

    // Raw intent stored; bikeData is NOT seeded here (that happens in bike-setup).
    expect(useOnboardingStore.getState().pendingIntent).toMatchObject({
      make: 'Yamaha',
      model: 'MT-07',
      source: 'blog',
      campaign: 'blog_maintenance',
    });
    expect(useOnboardingStore.getState().bikeData).toBeNull();

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(''); // our token cleared
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'pending_intent_resolved',
      expect.objectContaining({ make: 'Yamaha', method: 'clipboard' }),
    );
    expect(analytics.setUserPropertiesOnce).toHaveBeenCalledWith(
      expect.objectContaining({ intent_make: 'Yamaha' }),
    );
    expect(analytics.registerSuperProperties).toHaveBeenCalledWith({
      intent_cohort: 'maintenance',
    });
  });

  it('stores the raw intent even for an unknown make (bike-setup falls back to grid)', async () => {
    Clipboard.getStringAsync.mockResolvedValue(token(`mv_make=Peugeot&ts=${Date.now()}`));

    await resolvePendingIntent();

    // The reader does not judge the make — it just carries the intent. bike-setup
    // resolves against the make list; an unknown make → normal grid (fail-open).
    expect(useOnboardingStore.getState().pendingIntent).toMatchObject({ make: 'Peugeot' });
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'pending_intent_resolved',
      expect.objectContaining({ make: 'Peugeot' }),
    );
  });

  it('does NOT touch clipboard content that is not our token (no clear, no intent)', async () => {
    Clipboard.getStringAsync.mockResolvedValue('https://example.com/some-other-link');

    await resolvePendingIntent();

    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
  });

  it('never triggers the paste read when the clipboard is empty (no prompt)', async () => {
    Clipboard.hasStringAsync.mockResolvedValue(false);

    await resolvePendingIntent();

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pending_intent_checked', '1');
  });

  it('ignores an expired token (clears it, but no intent / no event)', async () => {
    Clipboard.getStringAsync.mockResolvedValue(
      token(`mv_make=Yamaha&mv_model=MT-07&ts=${Date.now() - 2 * 60 * 60 * 1000}`),
    );

    await resolvePendingIntent();

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(''); // was our token → cleared
    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('is a one-shot: does nothing when already checked', async () => {
    SecureStore.getItemAsync.mockResolvedValue('1');

    await resolvePendingIntent();

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().pendingIntent).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
