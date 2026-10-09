// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route (its context regex only skips +api/+html), so a test there would
// be bundled into the app as a screen.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// The onboarding shell reads flow progress; these screens are outside the flow.
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ variant: 'garage_first', stepIndex: -1, totalScreens: 0 }),
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('expo-image', () => ({ Image: () => null }));

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('../../lib/oauth', () => ({
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  reportUnexpectedAuthError: jest.fn(),
}));
jest.mock('../../lib/oauth-error-alert', () => ({ presentOAuthError: jest.fn() }));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

const mockSignInWithPassword = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args) },
  },
}));

const mockSendSignupCode = jest.fn();
const mockVerifySignupCode = jest.fn();
jest.mock('../../lib/email-confirmation', () => ({
  ...jest.requireActual('../../lib/email-confirmation'),
  sendSignupCode: (...args: unknown[]) => mockSendSignupCode(...args),
  verifySignupCode: (...args: unknown[]) => mockVerifySignupCode(...args),
}));

import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import LoginScreen from '../../app/(auth)/login';
import i18n from '../../i18n';

const EMAIL = 'rider@example.com';
const PASSWORD = 'hunter22';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const notConfirmed = () => new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');
const sendRateLimited = (seconds: number) =>
  new AuthApiError(
    `For security purposes, you can only request this after ${seconds} seconds.`,
    429,
    'over_email_send_rate_limit',
  );
const networkError = () => new AuthRetryableFetchError('Failed to fetch', 0);

const CODE_TITLE = () => t('auth.codeTitle');

async function flush() {
  await act(async () => {});
}

async function signIn() {
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByLabelText(t('auth.email')), EMAIL);
  await fireEvent.changeText(screen.getByLabelText(t('auth.password')), PASSWORD);
  await fireEvent.press(screen.getByText(t('auth.signIn')));
  await flush();
}

function eventsNamed(name: string) {
  return mockTrackEvent.mock.calls.filter(([event]) => event === name);
}

let alertSpy: jest.SpyInstance;
let backHandlers: Array<() => boolean | null | undefined>;

beforeEach(() => {
  jest.useFakeTimers();
  mockTrackEvent.mockReset();
  mockSignInWithPassword.mockReset();
  mockSendSignupCode.mockReset();
  mockVerifySignupCode.mockReset();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler);
    return {
      remove: () => {
        backHandlers = backHandlers.filter((h) => h !== handler);
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Login with an unconfirmed account', () => {
  it('sends a code and opens the code step', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });

    await signIn();

    expect(mockSendSignupCode).toHaveBeenCalledWith(EMAIL);
    expect(screen.getByText(CODE_TITLE())).toBeTruthy();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([
      ['EMAIL_CODE_SENT', { source: 'signin_unconfirmed' }],
    ]);
    expect(eventsNamed('USER_SIGNED_IN')).toEqual([]);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a rate-limited send opens the code step with the countdown and no alert', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: sendRateLimited(45) });

    await signIn();

    expect(screen.getByText(CODE_TITLE())).toBeTruthy();
    expect(screen.getByText(t('auth.codeResendIn', { seconds: 45 }))).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([]);
  });

  it('a network error on sign-in keeps the existing generic alert', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: networkError() });

    await signIn();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0]?.[0]).toBe(t('common.error'));
    expect(mockSendSignupCode).not.toHaveBeenCalled();
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
  });

  it('a failed code send keeps the form and says the code could not be sent', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: networkError() });

    await signIn();

    expect(alertSpy).toHaveBeenCalledWith(t('common.error'), t('auth.codeSendFailed'));
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.queryByText(t('onboarding.obSignInNotFound'))).toBeNull();
    expect(screen.getByLabelText(t('auth.email')).props.value).toBe(EMAIL);
  });

  it('Change email returns to the form with the email kept and the password cleared', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });
    await signIn();

    await fireEvent.press(screen.getByText(t('auth.codeChangeEmail')));

    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.getByLabelText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByLabelText(t('auth.password')).props.value).toBe('');
  });

  it('Android hardware back returns to the form', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });
    await signIn();
    expect(backHandlers).toHaveLength(1);

    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[0]?.();
    });

    expect(handled).toBe(true);
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.getByLabelText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByLabelText(t('auth.password')).props.value).toBe('');
  });

  it('Android hardware back during a pending verify keeps the code step', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });
    mockVerifySignupCode.mockReturnValue(new Promise(() => {}));
    await signIn();

    await fireEvent.changeText(screen.getByLabelText(t('auth.codeInputLabel')), '482913');
    await flush();
    expect(mockVerifySignupCode).toHaveBeenCalledWith(EMAIL, '482913');

    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[backHandlers.length - 1]?.();
    });

    expect(handled).toBe(true);
    expect(screen.getByText(CODE_TITLE())).toBeTruthy();
    expect(screen.getByText(t('auth.codeVerifying'))).toBeTruthy();
  });

  it('a direct sign-in still fires USER_SIGNED_IN', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });

    await signIn();

    expect(eventsNamed('USER_SIGNED_IN')).toEqual([['USER_SIGNED_IN', { auth_method: 'email' }]]);
  });
});
