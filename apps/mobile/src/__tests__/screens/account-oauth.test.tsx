// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route (its context regex only skips +api/+html), so a test there would
// be bundled into the app as a screen.
//
// Apple and Google on the onboarding account screen: a sign-up or sign-in
// through either must be counted like it is on every other sign-in surface,
// with the provider as `auth_method`, and the tap haptic must go through the
// iOS-guarded wrapper (jest-expo inlines EXPO_OS to 'ios' at transform time,
// so the platform itself cannot be flipped here).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ variant: 'shipped', stepIndex: 9, totalScreens: 11 }),
  useOnboardingNext: () => jest.fn(),
  useOnboardingVariant: () => 'shipped',
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    isLoading: false,
    isError: false,
    data: { me: { preferences: { onboardingCompleted: false } } },
  }),
}));
jest.mock('../../lib/query-options', () => ({ meOptions: () => ({}) }));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  resetUser: jest.fn(),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../../lib/onboarding-analytics', () => ({ trackOnboardingEvent: jest.fn() }));
jest.mock('../../lib/analytics-consent', () => ({
  signUpConsentMetadata: () => ({ analytics_consent: 'granted' }),
}));
const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();
jest.mock('../../lib/oauth', () => ({
  reportUnexpectedAuthError: jest.fn(),
  signInWithApple: (...args: unknown[]) => mockSignInWithApple(...args),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));
jest.mock('../../lib/oauth-error-alert', () => ({ presentOAuthError: jest.fn() }));
jest.mock('../../components/onboarding/oauth-glyphs', () => ({
  AppleGlyph: () => null,
  GoogleGlyph: () => null,
}));
jest.mock('../../lib/subscription', () => ({ logoutRevenueCat: jest.fn() }));
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      verifyOtp: jest.fn(),
      resend: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));
jest.mock('../../stores/onboarding.store', () => ({
  useOnboardingStore: { getState: () => ({ bikeData: null }) },
}));
jest.mock('../../stores/auth.store', () => {
  const { create } = require('zustand');
  return { useAuthStore: create(() => ({ session: null })) };
});
jest.mock('../../stores/subscription.store', () => {
  const { create } = require('zustand');
  return { useSubscriptionStore: create(() => ({ isPro: false })) };
});

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import AccountScreen from '../../app/(onboarding)/account';
import i18n from '../../i18n';
import { triggerImpact } from '../../utils/haptics';

const t = (key: string) => i18n.t(key);

async function tap(label: string) {
  await render(<AccountScreen />);
  await fireEvent.press(screen.getByText(t(label)));
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AccountScreen Apple and Google', () => {
  it('a Google sign-in that created the account fires user_signed_up once, auth_method google', async () => {
    mockSignInWithGoogle.mockResolvedValue({ isNewUser: true });

    await tap('auth.continueWithGoogle');

    expect(mockTrackEvent.mock.calls).toEqual([['USER_SIGNED_UP', { auth_method: 'google' }]]);
  });

  it('an Apple sign-in to an existing account fires user_signed_in once, auth_method apple', async () => {
    mockSignInWithApple.mockResolvedValue({ isNewUser: false });

    await tap('auth.continueWithApple');

    expect(mockTrackEvent.mock.calls).toEqual([['USER_SIGNED_IN', { auth_method: 'apple' }]]);
  });

  it('a cancelled sign-in fires nothing', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Google sign-in was cancelled'));

    await tap('auth.continueWithGoogle');

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('plays the tap haptic through the iOS-guarded wrapper, never expo-haptics directly', async () => {
    mockSignInWithGoogle.mockResolvedValue({ isNewUser: false });

    await tap('auth.continueWithGoogle');

    expect(triggerImpact).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
