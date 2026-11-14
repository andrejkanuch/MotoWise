// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// issue 365 T12 (FS-OB2b, FS-OB2c) on the onboarding account step:
// - the "Creating your account…" wait for the server onboarding state is bounded:
//   if `me` has not settled ACCOUNT_ME_WAIT_MS after the session landed, the flow
//   advances anyway (the root gate still routes an onboarded account to the tabs);
// - a cancelled Apple/Google sheet is silent: no presentOAuthError, no alert;
// - from the tap until the sign-in settles, both provider buttons are disabled and
//   the tapped one shows a spinner (no second sheet, visible progress).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
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
  isLoading: true,
  isError: false,
  data: undefined as unknown,
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
const mockPresentOAuthError = jest.fn();
jest.mock('../../lib/oauth-error-alert', () => ({
  presentOAuthError: (...args: unknown[]) => mockPresentOAuthError(...args),
}));
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
  useOnboardingStore: { getState: () => ({ bikeData: null, setCodeStepPending: () => {} }) },
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
import { Alert } from 'react-native';
import AccountScreen from '../../app/(onboarding)/account';
import i18n from '../../i18n';
import { useAuthStore } from '../../stores/auth.store';

const t = (key: string) => i18n.t(key);
const SESSION = { user: { id: 'u1' } };
const NOW = 1_700_000_000_000;
const WAIT_LIMIT_MS = 8_000;

function waits() {
  return mockTrackEvent.mock.calls.filter(([event]) => event === 'AUTH_POST_SIGNIN_WAIT');
}

async function sessionLands() {
  await act(async () => {
    useAuthStore.setState({ session: SESSION });
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW });
  useAuthStore.setState({ session: null });
  mockMeQuery.isLoading = true;
  mockMeQuery.isError = false;
  mockMeQuery.data = undefined;
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

describe('AccountScreen post-sign-in wait is bounded (FS-OB2b)', () => {
  it('me never settles: advances once at 8 s with outcome timeout', async () => {
    await render(<AccountScreen />);
    await sessionLands();

    await advance(WAIT_LIMIT_MS - 1);
    expect(mockGoNext).not.toHaveBeenCalled();
    expect(waits()).toHaveLength(0);

    await advance(1);
    expect(mockGoNext).toHaveBeenCalledTimes(1);
    expect(waits()).toEqual([
      ['AUTH_POST_SIGNIN_WAIT', { wait_ms: WAIT_LIMIT_MS, outcome: 'timeout' }],
    ]);

    // me settling later changes nothing: the step already moved on.
    mockMeQuery.isLoading = false;
    mockMeQuery.data = { me: { preferences: { onboardingCompleted: false } } };
    await sessionLands();
    await advance(30_000);
    expect(mockGoNext).toHaveBeenCalledTimes(1);
    expect(waits()).toHaveLength(1);
  });

  it('me settles onboarded at 1 s: no advance, then or after the limit', async () => {
    await render(<AccountScreen />);
    await sessionLands();

    await advance(1_000);
    mockMeQuery.isLoading = false;
    mockMeQuery.data = { me: { preferences: { onboardingCompleted: true } } };
    await act(async () => {
      useAuthStore.setState({ session: { ...SESSION } });
    });

    await advance(WAIT_LIMIT_MS * 2);
    expect(mockGoNext).not.toHaveBeenCalled();
    expect(waits()).toEqual([
      ['AUTH_POST_SIGNIN_WAIT', { wait_ms: 1_000, outcome: 'already_onboarded' }],
    ]);
  });

  it('no session: the limit never starts', async () => {
    await render(<AccountScreen />);
    await advance(WAIT_LIMIT_MS * 2);
    expect(mockGoNext).not.toHaveBeenCalled();
    expect(waits()).toHaveLength(0);
  });
});

describe('AccountScreen OAuth cancel is silent (FS-OB2c)', () => {
  it.each([
    ['auth.continueWithGoogle', mockSignInWithGoogle, new Error('Google sign-in was cancelled')],
    [
      'auth.continueWithApple',
      mockSignInWithApple,
      Object.assign(new Error('The user canceled the authorization attempt'), {
        code: 'ERR_REQUEST_CANCELED',
      }),
    ],
  ])('%s cancelled: no presentOAuthError, no alert', async (label, signIn, err) => {
    signIn.mockRejectedValue(err);
    await render(<AccountScreen />);

    await fireEvent.press(screen.getByRole('button', { name: t(label) }));
    await act(async () => {});

    expect(mockPresentOAuthError).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: t(label) })).toBeEnabled();
  });

  it('a real failure is still presented', async () => {
    const err = new Error('No identity token');
    mockSignInWithGoogle.mockRejectedValue(err);
    await render(<AccountScreen />);

    await fireEvent.press(screen.getByRole('button', { name: t('auth.continueWithGoogle') }));
    await act(async () => {});

    expect(mockPresentOAuthError.mock.calls).toEqual([[err, 'google']]);
  });
});

describe('AccountScreen OAuth busy state from tap to settle', () => {
  it('disables both providers and marks the tapped one busy until the sign-in settles', async () => {
    let finish: (value: { isNewUser: boolean }) => void = () => {};
    mockSignInWithGoogle.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render(<AccountScreen />);
    const google = () => screen.getByRole('button', { name: t('auth.continueWithGoogle') });
    const apple = () => screen.getByRole('button', { name: t('auth.continueWithApple') });

    // Not awaited: the press resolves only when the sign-in does.
    const press = fireEvent.press(google());
    await act(async () => {});

    expect(google()).toBeDisabled();
    expect(google()).toBeBusy();
    expect(apple()).toBeDisabled();
    expect(apple()).not.toBeBusy();

    await act(async () => {
      finish({ isNewUser: true });
      await press;
    });

    expect(google()).toBeEnabled();
    expect(google()).not.toBeBusy();
    expect(apple()).toBeEnabled();
  });
});
