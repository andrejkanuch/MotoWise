// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route (its context regex only skips +api/+html), so a test there would
// be bundled into the app as a screen.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockGoNext = jest.fn();
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ variant: 'shipped', stepIndex: 9, totalScreens: 11 }),
  useOnboardingNext: () => mockGoNext,
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
const mockResetUser = jest.fn();
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  resetUser: (...args: unknown[]) => mockResetUser(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../../lib/onboarding-analytics', () => ({ trackOnboardingEvent: jest.fn() }));
jest.mock('../../lib/analytics-consent', () => ({
  signUpConsentMetadata: () => ({ analytics_consent: 'granted' }),
}));
jest.mock('../../lib/oauth', () => ({
  reportUnexpectedAuthError: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));
jest.mock('../../lib/oauth-error-alert', () => ({ presentOAuthError: jest.fn() }));
jest.mock('../../components/onboarding/oauth-glyphs', () => ({
  AppleGlyph: () => null,
  GoogleGlyph: () => null,
}));

const mockLogoutRevenueCat = jest.fn();
jest.mock('../../lib/subscription', () => ({
  logoutRevenueCat: (...args: unknown[]) => mockLogoutRevenueCat(...args),
}));

const mockSignUp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResend = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

// The screen reads `bikeData` from the onboarding store for its Back route.
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

import { AuthApiError } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import AccountScreen from '../../app/(onboarding)/account';
import { OB_ROUTE } from '../../config/onboarding';
import i18n from '../../i18n';
import { useAuthStore } from '../../stores/auth.store';

const EMAIL = 'rider@example.com';
const PASSWORD = 'hunter22';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

type BackListener = () => boolean | null | undefined;
let backListeners: BackListener[] = [];

/** What Android does on a hardware back: the newest listener first, until one handles it. */
function pressAndroidBack(): boolean {
  for (const listener of [...backListeners].reverse()) {
    if (listener()) return true;
  }
  return false;
}

const newUser = {
  data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null },
  error: null,
};
const existingUser = { data: { user: { id: 'u1', identities: [] }, session: null }, error: null };
const sendRateLimited = (seconds: number) => ({
  data: { user: null, session: null },
  error: new AuthApiError(
    `For security purposes, you can only request this after ${seconds} seconds.`,
    429,
    'over_email_send_rate_limit',
  ),
});

let alertSpy: jest.SpyInstance;

async function flush() {
  await act(async () => {});
}

async function submitSignup(email = EMAIL, password = PASSWORD) {
  await render(<AccountScreen />);
  await fireEvent.press(screen.getByText(t('onboarding.obAccountWithEmail')));
  await fireEvent.changeText(screen.getByLabelText(t('auth.email')), email);
  await fireEvent.changeText(screen.getByLabelText(t('auth.password')), password);
  await fireEvent.press(screen.getByText(t('onboarding.obAccountCreate')));
  await flush();
}

function codeStepShown() {
  return screen.queryByLabelText(t('auth.codeInputLabel')) !== null;
}

function eventsNamed(name: string) {
  return mockTrackEvent.mock.calls.filter(([event]) => event === name);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  backListeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    backListeners.push(listener);
    return {
      remove: () => {
        backListeners = backListeners.filter((l) => l !== listener);
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AccountScreen email signup', () => {
  it('opens the code step with the address, and shows no alert', async () => {
    mockSignUp.mockResolvedValue(newUser);
    await submitSignup('  Rider@Example.com ');

    expect(codeStepShown()).toBe(true);
    expect(screen.getByText(t('auth.codeSentTo', { digits: 6, email: EMAIL }))).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, password: PASSWORD }),
    );
  });

  it('reports the signup send as email_code_sent {source: signup}, once', async () => {
    mockSignUp.mockResolvedValue(newUser);
    await submitSignup();

    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([['EMAIL_CODE_SENT', { source: 'signup' }]]);
    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(0);
  });

  it('keeps the account-exists alert for an already-registered address', async () => {
    mockSignUp.mockResolvedValue(existingUser);
    await submitSignup();

    expect(codeStepShown()).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe(t('auth.accountExistsTitle'));
    expect(message).toBe(t('auth.accountExistsMessage'));
    buttons[1].onPress();
    expect(mockRouter.push).toHaveBeenCalledWith(OB_ROUTE.SIGN_IN);
    expect(eventsNamed('EMAIL_CODE_SENT')).toHaveLength(0);
  });

  it('opens the code step with the countdown running when the send was rate-limited', async () => {
    mockSignUp.mockResolvedValue(sendRateLimited(30));
    await submitSignup();

    expect(codeStepShown()).toBe(true);
    expect(screen.getByText(t('auth.codeResendIn', { seconds: 30 }))).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('still alerts on other signUp errors', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Password should be at least 6 characters', 422, 'weak_password'),
    });
    await submitSignup();

    expect(codeStepShown()).toBe(false);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('Change email returns to the form with the email kept and the password cleared', async () => {
    mockSignUp.mockResolvedValue(newUser);
    await submitSignup();

    await fireEvent.press(screen.getByText(t('auth.codeChangeEmail')));

    expect(codeStepShown()).toBe(false);
    expect(screen.getByLabelText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByLabelText(t('auth.password')).props.value).toBe('');
  });

  it('Android back from the code step returns to the form and does not leave the screen', async () => {
    mockSignUp.mockResolvedValue(newUser);
    await submitSignup();

    let handled = false;
    await act(async () => {
      handled = pressAndroidBack();
    });

    expect(handled).toBe(true);
    expect(codeStepShown()).toBe(false);
    expect(screen.getByLabelText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByLabelText(t('auth.password')).props.value).toBe('');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    // Back on the form, the hardware back is the screen's normal back again.
    expect(backListeners).toHaveLength(0);
  });

  it('the header Back from the code step returns to the form instead of leaving onboarding', async () => {
    mockSignUp.mockResolvedValue(newUser);
    await submitSignup();

    // The shell's back control is labelled with common.back.
    await fireEvent.press(screen.getByLabelText(t('common.back')));

    expect(codeStepShown()).toBe(false);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('verify success counts the signup once, advances once, and never signs out or resets identity', async () => {
    mockSignUp.mockResolvedValue(newUser);
    mockVerifyOtp.mockResolvedValue({ data: {}, error: null });
    await submitSignup();

    await fireEvent.changeText(screen.getByLabelText(t('auth.codeInputLabel')), '482913');
    await flush();

    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '482913', type: 'email' });
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([['USER_SIGNED_UP', { auth_method: 'email' }]]);

    // onAuthStateChange would set the session; the screen's session effect advances.
    await act(async () => {
      useAuthStore.setState({ session: { user: { id: 'u1' } } });
    });
    await flush();

    expect(mockGoNext).toHaveBeenCalledTimes(1);
    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(1);
    expect(mockResetUser).not.toHaveBeenCalled();
    expect(mockLogoutRevenueCat).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('an immediate session (confirmations off) still counts the signup once', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: { access_token: 'x' } },
      error: null,
    });
    await submitSignup();

    expect(codeStepShown()).toBe(false);
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([['USER_SIGNED_UP', { auth_method: 'email' }]]);
    expect(eventsNamed('EMAIL_CODE_SENT')).toHaveLength(0);
  });
});
