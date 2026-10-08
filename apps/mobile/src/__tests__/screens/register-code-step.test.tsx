// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route (its context regex only skips +api/+html), so a test there would
// be bundled into the app as a screen.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
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
jest.mock('../../lib/analytics-consent', () => ({ signUpConsentMetadata: () => ({}) }));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  },
}));

const mockVerifySignupCode = jest.fn();
jest.mock('../../lib/email-confirmation', () => ({
  ...jest.requireActual('../../lib/email-confirmation'),
  sendSignupCode: jest.fn(),
  verifySignupCode: (...args: unknown[]) => mockVerifySignupCode(...args),
}));

import { AuthApiError } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import RegisterScreen from '../../app/(auth)/register';
import i18n from '../../i18n';

const EMAIL = 'rider@example.com';
const PASSWORD = 'hunter22';
const NAME = 'Ada Rider';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const sendRateLimited = (seconds: number) =>
  new AuthApiError(
    `For security purposes, you can only request this after ${seconds} seconds.`,
    429,
    'over_email_send_rate_limit',
  );

const CODE_TITLE = () => t('auth.codeTitle');
const noSession = { data: { user: { id: 'u1' }, session: null }, error: null };

async function flush() {
  await act(async () => {});
}

async function register() {
  await render(<RegisterScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(t('auth.fullName')), NAME);
  await fireEvent.changeText(screen.getByPlaceholderText(t('auth.email')), EMAIL);
  await fireEvent.changeText(screen.getByPlaceholderText(t('auth.password')), PASSWORD);
  // The header title and the submit button share the label; the button is last.
  const labels = screen.getAllByText(t('auth.signUp'));
  await fireEvent.press(labels[labels.length - 1]);
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
  mockSignUp.mockReset();
  mockSignInWithPassword.mockReset();
  mockVerifySignupCode.mockReset();
  mockRouter.replace.mockReset();
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

describe('Register with email confirmation', () => {
  it('opens the code step on a no-session signup and fires USER_SIGNED_UP only after verify', async () => {
    mockSignUp.mockResolvedValue(noSession);
    mockVerifySignupCode.mockResolvedValue({ error: null });

    await register();

    expect(screen.getByText(CODE_TITLE())).toBeTruthy();
    expect(screen.getByText(t('auth.codeSentTo', { digits: 6, email: EMAIL }))).toBeTruthy();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([['EMAIL_CODE_SENT', { source: 'signup' }]]);
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([]);
    expect(alertSpy).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(t('auth.codeInputLabel')), '482913');
    await flush();

    expect(mockVerifySignupCode).toHaveBeenCalledWith(EMAIL, '482913');
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([['USER_SIGNED_UP', { auth_method: 'email' }]]);
  });

  it('a rate-limited signup opens the code step with the countdown and no alert', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: sendRateLimited(30),
    });

    await register();

    expect(screen.getByText(CODE_TITLE())).toBeTruthy();
    expect(screen.getByText(t('auth.codeResendIn', { seconds: 30 }))).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([]);
  });

  it('a signup that returns a session still fires USER_SIGNED_UP immediately', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'x' } },
      error: null,
    });

    await register();

    expect(eventsNamed('USER_SIGNED_UP')).toEqual([['USER_SIGNED_UP', { auth_method: 'email' }]]);
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
  });

  it('Change email returns to the form with the email kept and the password cleared', async () => {
    mockSignUp.mockResolvedValue(noSession);
    await register();

    await fireEvent.press(screen.getByText(t('auth.codeChangeEmail')));

    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.getByPlaceholderText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByPlaceholderText(t('auth.fullName')).props.value).toBe(NAME);
    expect(screen.getByPlaceholderText(t('auth.password')).props.value).toBe('');
  });

  it('Android hardware back returns to the form', async () => {
    mockSignUp.mockResolvedValue(noSession);
    await register();
    expect(backHandlers).toHaveLength(1);

    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[0]?.();
    });

    expect(handled).toBe(true);
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.getByPlaceholderText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByPlaceholderText(t('auth.password')).props.value).toBe('');
  });
});
