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
const mockGoNext = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ variant: 'shipped', stepIndex: 9, totalScreens: 11 }),
  useOnboardingNext: () => mockGoNext,
  useOnboardingVariant: () => 'shipped',
}));

const mockMeQuery = {
  isLoading: false,
  isError: false,
  data: { me: { preferences: { onboardingCompleted: false } } } as unknown,
};
jest.mock('@tanstack/react-query', () => ({ useQuery: () => mockMeQuery }));
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
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn() },
  isSuccessResponse: jest.fn(),
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e !== null && 'code' in e,
  statusCodes: {},
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({}));
jest.mock('../../lib/oauth', () => ({
  ...jest.requireActual('../../lib/oauth'),
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
import { useAuthStore } from '../../stores/auth.store';
import { triggerImpact } from '../../utils/haptics';

const t = (key: string) => i18n.t(key);

async function tap(label: string) {
  await render(<AccountScreen />);
  await fireEvent.press(screen.getByText(t(label)));
  await act(async () => {});
}

function eventsNamed(name: string) {
  return mockTrackEvent.mock.calls.filter(([event]) => event === name);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null });
  mockMeQuery.isLoading = false;
  mockMeQuery.isError = false;
  mockMeQuery.data = { me: { preferences: { onboardingCompleted: false } } };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AccountScreen Apple and Google', () => {
  it('a Google sign-in that created the account fires user_signed_up once, auth_method google', async () => {
    mockSignInWithGoogle.mockResolvedValue({ isNewUser: true });

    await tap('auth.continueWithGoogle');

    expect(eventsNamed('USER_SIGNED_UP')).toEqual([
      ['USER_SIGNED_UP', { auth_method: 'google', surface: 'onboarding_account' }],
    ]);
    expect(eventsNamed('USER_SIGNED_IN')).toHaveLength(0);
  });

  it('an Apple sign-in to an existing account fires user_signed_in once, auth_method apple', async () => {
    mockSignInWithApple.mockResolvedValue({ isNewUser: false });

    await tap('auth.continueWithApple');

    expect(eventsNamed('USER_SIGNED_IN')).toEqual([
      ['USER_SIGNED_IN', { auth_method: 'apple', surface: 'onboarding_account' }],
    ]);
    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(0);
  });

  it('a cancelled sign-in fires no sign-up or sign-in, one started and one cancelled result', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Google sign-in was cancelled'));

    await tap('auth.continueWithGoogle');

    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(0);
    expect(eventsNamed('USER_SIGNED_IN')).toHaveLength(0);
    expect(eventsNamed('AUTH_OAUTH_STARTED')).toEqual([
      ['AUTH_OAUTH_STARTED', { provider: 'google', surface: 'onboarding_account' }],
    ]);
    expect(eventsNamed('AUTH_OAUTH_RESULT')).toEqual([
      [
        'AUTH_OAUTH_RESULT',
        expect.objectContaining({
          provider: 'google',
          surface: 'onboarding_account',
          outcome: 'cancelled',
          stage: 'sheet',
        }),
      ],
    ]);
  });

  it('plays the tap haptic through the iOS-guarded wrapper, never expo-haptics directly', async () => {
    mockSignInWithGoogle.mockResolvedValue({ isNewUser: false });

    await tap('auth.continueWithGoogle');

    expect(triggerImpact).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

// issue 365 T04a (FS-OB2b): how long the account step waited for the server
// onboarding state once the session landed, and what it decided.
describe('AccountScreen auth_post_signin_wait', () => {
  const SESSION = { user: { id: 'u1' } };
  const NOW = 1_700_000_000_000;

  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  async function sessionLands() {
    await act(async () => {
      useAuthStore.setState({ session: SESSION });
    });
  }

  async function meSettles(next: Partial<typeof mockMeQuery>, waitMs: number) {
    jest.setSystemTime(NOW + waitMs);
    Object.assign(mockMeQuery, next);
    // Re-render with the settled query (the store update stands in for the query's own re-render).
    await act(async () => {
      useAuthStore.setState({ session: { ...SESSION } });
    });
  }

  function waits() {
    return eventsNamed('AUTH_POST_SIGNIN_WAIT');
  }

  it('a new account: one {advanced} with the wait from session to decision', async () => {
    mockMeQuery.isLoading = true;
    mockMeQuery.data = undefined;
    await render(<AccountScreen />);
    await sessionLands();
    expect(waits()).toHaveLength(0);

    await meSettles(
      { isLoading: false, data: { me: { preferences: { onboardingCompleted: false } } } },
      2_500,
    );

    expect(waits()).toEqual([['AUTH_POST_SIGNIN_WAIT', { wait_ms: 2_500, outcome: 'advanced' }]]);
    expect(mockGoNext).toHaveBeenCalledTimes(1);
  });

  it('an already-onboarded account: one {already_onboarded}, no advance', async () => {
    mockMeQuery.isLoading = true;
    mockMeQuery.data = undefined;
    await render(<AccountScreen />);
    await sessionLands();

    await meSettles(
      { isLoading: false, data: { me: { preferences: { onboardingCompleted: true } } } },
      900,
    );

    expect(waits()).toEqual([
      ['AUTH_POST_SIGNIN_WAIT', { wait_ms: 900, outcome: 'already_onboarded' }],
    ]);
    expect(mockGoNext).not.toHaveBeenCalled();
  });

  it('a failed me query: one {me_error}, and the flow still advances', async () => {
    mockMeQuery.isLoading = true;
    mockMeQuery.data = undefined;
    await render(<AccountScreen />);
    await sessionLands();

    await meSettles({ isLoading: false, isError: true }, 4_000);

    expect(waits()).toEqual([['AUTH_POST_SIGNIN_WAIT', { wait_ms: 4_000, outcome: 'me_error' }]]);
    expect(mockGoNext).toHaveBeenCalledTimes(1);
  });

  it('a cache hit decides at once, and later re-renders fire nothing more', async () => {
    await render(<AccountScreen />);
    await sessionLands();
    await meSettles({}, 5_000);

    expect(waits()).toEqual([['AUTH_POST_SIGNIN_WAIT', { wait_ms: 0, outcome: 'advanced' }]]);
  });
});
