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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('../../components/onboarding/oauth-glyphs', () => ({
  AppleGlyph: () => null,
  GoogleGlyph: () => null,
}));
jest.mock('../../lib/oauth', () => ({
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  reportUnexpectedAuthError: jest.fn(),
}));
jest.mock('../../lib/oauth-error-alert', () => ({ presentOAuthError: jest.fn() }));
jest.mock('../../lib/onboarding-analytics', () => ({ trackOnboardingFlowEvent: jest.fn() }));

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
jest.mock('../../lib/email-confirmation', () => ({
  ...jest.requireActual('../../lib/email-confirmation'),
  sendSignupCode: (...args: unknown[]) => mockSendSignupCode(...args),
}));

import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import OnboardingSignInScreen from '../../app/(onboarding)/sign-in';
import i18n from '../../i18n';

const EMAIL = 'rider@example.com';
const PASSWORD = 'hunter22';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const notConfirmed = () => new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');
const invalidCredentials = () =>
  new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
const networkError = () => new AuthRetryableFetchError('Failed to fetch', 0);

const NOT_FOUND = () => t('onboarding.obSignInNotFound');
const CODE_TITLE = () => t('auth.codeTitle');

async function flush() {
  await act(async () => {});
}

async function signIn() {
  await render(<OnboardingSignInScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText(t('auth.email')), EMAIL);
  await fireEvent.changeText(screen.getByPlaceholderText(t('auth.password')), PASSWORD);
  await fireEvent.press(screen.getByText(t('auth.signIn')));
  await flush();
}

function eventsNamed(name: string) {
  return mockTrackEvent.mock.calls.filter(([event]) => event === name);
}

let alertSpy: jest.SpyInstance;
let backHandlers: Array<() => boolean | null | undefined>;

beforeEach(() => {
  mockTrackEvent.mockReset();
  mockSignInWithPassword.mockReset();
  mockSendSignupCode.mockReset();
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
});

describe('Onboarding sign-in with an unconfirmed account', () => {
  it('sends a fresh code and opens the code step instead of "no account found"', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });

    await signIn();

    expect(mockSendSignupCode).toHaveBeenCalledWith(EMAIL);
    expect(screen.getByText(CODE_TITLE())).toBeTruthy();
    expect(screen.getByText(t('auth.codeSentTo', { digits: 6, email: EMAIL }))).toBeTruthy();
    expect(screen.queryByText(NOT_FOUND())).toBeNull();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([
      ['EMAIL_CODE_SENT', { source: 'signin_unconfirmed' }],
    ]);
    expect(eventsNamed('USER_SIGNED_IN')).toEqual([]);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('keeps the not-found state for invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: invalidCredentials() });

    await signIn();

    expect(screen.getByText(NOT_FOUND())).toBeTruthy();
    expect(mockSendSignupCode).not.toHaveBeenCalled();
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
  });

  it('stays on the form with the send-failed message when the code send fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: networkError() });

    await signIn();

    expect(screen.getByText(t('auth.codeSendFailed'))).toBeTruthy();
    expect(screen.getByPlaceholderText(t('auth.email'))).toBeTruthy();
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.queryByText(NOT_FOUND())).toBeNull();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([]);
  });

  it('Change email returns to the form with the email kept and the password cleared', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });
    await signIn();

    await fireEvent.press(screen.getByText(t('auth.codeChangeEmail')));

    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.getByPlaceholderText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByPlaceholderText(t('auth.password')).props.value).toBe('');
  });

  it('Android hardware back returns to the form instead of leaving the screen', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: notConfirmed() });
    mockSendSignupCode.mockResolvedValue({ error: null });
    await signIn();
    expect(backHandlers).toHaveLength(1);

    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[0]?.();
    });

    expect(handled).toBe(true);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.queryByText(CODE_TITLE())).toBeNull();
    expect(screen.getByPlaceholderText(t('auth.email')).props.value).toBe(EMAIL);
    expect(screen.getByPlaceholderText(t('auth.password')).props.value).toBe('');
    expect(backHandlers).toHaveLength(0);
  });

  it('a direct sign-in still fires USER_SIGNED_IN', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });

    await signIn();

    expect(eventsNamed('USER_SIGNED_IN')).toEqual([['USER_SIGNED_IN', { auth_method: 'email' }]]);
    expect(mockSendSignupCode).not.toHaveBeenCalled();
  });
});
