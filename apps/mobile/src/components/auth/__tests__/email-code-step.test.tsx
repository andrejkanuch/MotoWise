jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const mockTrackEvent = jest.fn();
const mockResetUser = jest.fn();
jest.mock('../../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  resetUser: (...args: unknown[]) => mockResetUser(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));

const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

const mockSendSignupCode = jest.fn();
const mockVerifySignupCode = jest.fn();
jest.mock('../../../lib/email-confirmation', () => ({
  ...jest.requireActual('../../../lib/email-confirmation'),
  sendSignupCode: (...args: unknown[]) => mockSendSignupCode(...args),
  verifySignupCode: (...args: unknown[]) => mockVerifySignupCode(...args),
}));

import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '../../../i18n';
import {
  EMAIL_CODE_SOURCE,
  EMAIL_CODE_STEP_THEME,
  EmailCodeStep,
  type EmailCodeStepProps,
} from '../email-code-step';

const EMAIL = 'rider@example.com';
const PASSWORD = 'hunter22';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const WRONG = () => t('auth.codeWrongOrExpired');

const otpExpired = () => new AuthApiError('Token has expired or is invalid', 403, 'otp_expired');
const notConfirmed = () => new AuthApiError('Email not confirmed', 400, 'email_not_confirmed');
const throttled = () =>
  new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit');
const sendRateLimited = (seconds: number) =>
  new AuthApiError(
    `For security purposes, you can only request this after ${seconds} seconds.`,
    429,
    'over_email_send_rate_limit',
  );
const networkError = () => new AuthRetryableFetchError('Failed to fetch', 0);

const ok = { error: null };
const signedIn = { data: { session: { access_token: 'x' } }, error: null };

function codeInput() {
  return screen.getByLabelText(t('auth.codeInputLabel'));
}

async function flush() {
  await act(async () => {});
}

async function renderStep(props: Partial<EmailCodeStepProps> = {}) {
  const onBack = jest.fn();
  const onNeedsSignIn = jest.fn();
  await render(
    <EmailCodeStep
      email={EMAIL}
      source={EMAIL_CODE_SOURCE.SIGNUP}
      theme={EMAIL_CODE_STEP_THEME.auth}
      onBack={onBack}
      onNeedsSignIn={onNeedsSignIn}
      {...props}
    />,
  );
  return { onBack, onNeedsSignIn };
}

function eventsNamed(name: string) {
  return mockTrackEvent.mock.calls.filter(([event]) => event === name);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockTrackEvent.mockReset();
  mockSignInWithPassword.mockReset();
  mockSendSignupCode.mockReset();
  mockVerifySignupCode.mockReset();
  mockResetUser.mockReset();
  mockSignOut.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('EmailCodeStep', () => {
  it('shows the address and code length the code went to', async () => {
    await renderStep();
    expect(screen.getByText(t('auth.codeTitle'))).toBeTruthy();
    expect(screen.getByText(t('auth.codeSentTo', { digits: 6, email: EMAIL }))).toBeTruthy();
  });

  it('strips surrounding text from a paste and verifies once', async () => {
    mockVerifySignupCode.mockResolvedValue(ok);
    await renderStep();

    await fireEvent.changeText(codeInput(), 'Your code: 482 913');
    await flush();

    expect(codeInput().props.value).toBe('482913');
    expect(mockVerifySignupCode).toHaveBeenCalledTimes(1);
    expect(mockVerifySignupCode).toHaveBeenCalledWith(EMAIL, '482913');
  });

  it('does not verify at five digits, verifies exactly once at six, even if typing continues', async () => {
    let resolveVerify: (value: typeof ok) => void = () => {};
    mockVerifySignupCode.mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );
    await renderStep();

    await fireEvent.changeText(codeInput(), '12345');
    expect(mockVerifySignupCode).not.toHaveBeenCalled();

    await fireEvent.changeText(codeInput(), '123456');
    await fireEvent.changeText(codeInput(), '1234567');
    await fireEvent.changeText(codeInput(), '123456');
    expect(mockVerifySignupCode).toHaveBeenCalledTimes(1);

    await act(async () => resolveVerify(ok));
    expect(mockVerifySignupCode).toHaveBeenCalledTimes(1);
  });

  it('invalid-or-expired with no password: clears the field, shows one message, tracks the failure', async () => {
    mockVerifySignupCode.mockResolvedValue({ error: otpExpired() });
    await renderStep();

    await fireEvent.changeText(codeInput(), '111111');
    await flush();

    expect(codeInput().props.value).toBe('');
    expect(screen.getAllByText(WRONG())).toHaveLength(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('EMAIL_CODE_FAILED', {
      source: EMAIL_CODE_SOURCE.SIGNUP,
      reason: 'invalid_or_expired',
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    EMAIL_CODE_SOURCE.SIGNUP,
    EMAIL_CODE_SOURCE.SIGNIN_UNCONFIRMED,
  ])('verify success from %s fires verified and signed-up once each', async (source) => {
    mockVerifySignupCode.mockResolvedValue(ok);
    await renderStep({ source });

    await fireEvent.changeText(codeInput(), '482913');
    await flush();

    expect(eventsNamed('EMAIL_CODE_VERIFIED')).toEqual([['EMAIL_CODE_VERIFIED', { source }]]);
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([['USER_SIGNED_UP', { auth_method: 'email' }]]);
    expect(mockResetUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('first invalid-or-expired with a password recovers by signing in', async () => {
    mockVerifySignupCode.mockResolvedValue({ error: otpExpired() });
    mockSignInWithPassword.mockResolvedValue(signedIn);
    await renderStep({ password: PASSWORD });

    await fireEvent.changeText(codeInput(), '111111');
    await flush();

    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(eventsNamed('EMAIL_CODE_RECOVERED')).toEqual([
      ['EMAIL_CODE_RECOVERED', { source: EMAIL_CODE_SOURCE.SIGNUP }],
    ]);
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([['USER_SIGNED_UP', { auth_method: 'email' }]]);
  });

  it('recovery that finds the email still unconfirmed keeps the error and never retries automatically', async () => {
    mockVerifySignupCode.mockResolvedValue({ error: otpExpired() });
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: notConfirmed() });
    await renderStep({ password: PASSWORD });

    await fireEvent.changeText(codeInput(), '111111');
    await flush();
    expect(screen.getByText(WRONG())).toBeTruthy();

    await fireEvent.changeText(codeInput(), '222222');
    await flush();

    expect(mockVerifySignupCode).toHaveBeenCalledTimes(2);
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(eventsNamed('USER_SIGNED_UP')).toEqual([]);
    expect(eventsNamed('EMAIL_CODE_RECOVERED')).toEqual([]);
  });

  it('throttled verify keeps the digits, disables the field and never says wrong code', async () => {
    mockVerifySignupCode.mockResolvedValue({ error: throttled() });
    await renderStep();

    await fireEvent.changeText(codeInput(), '482913');
    await flush();

    expect(screen.getByText(t('auth.codeTooManyAttempts'))).toBeTruthy();
    expect(codeInput().props.value).toBe('482913');
    expect(codeInput().props.editable).toBe(false);
    expect(screen.queryByText(WRONG())).toBeNull();
    expect(
      mockTrackEvent.mock.calls.some(
        ([event, props]) => event === 'EMAIL_CODE_FAILED' && props?.reason === 'invalid_or_expired',
      ),
    ).toBe(false);
  });

  it('network failure on verify keeps the digits and is not reported as a wrong code', async () => {
    mockVerifySignupCode.mockResolvedValue({ error: networkError() });
    await renderStep();

    await fireEvent.changeText(codeInput(), '482913');
    await flush();

    expect(codeInput().props.value).toBe('482913');
    expect(screen.getByText(t('auth.codeConnectionError'))).toBeTruthy();
    expect(screen.queryByText(WRONG())).toBeNull();
  });

  it('retries the kept code after a network failure without retyping it', async () => {
    mockVerifySignupCode.mockResolvedValueOnce({ error: networkError() }).mockResolvedValueOnce(ok);
    await renderStep();

    await fireEvent.changeText(codeInput(), '482913');
    await flush();
    await fireEvent.press(screen.getByText(t('common.tryAgain')));
    await flush();

    expect(mockVerifySignupCode).toHaveBeenCalledTimes(2);
    expect(mockVerifySignupCode).toHaveBeenLastCalledWith(EMAIL, '482913');
    expect(mockTrackEvent).toHaveBeenCalledWith('EMAIL_CODE_VERIFIED', { source: 'signup' });
  });

  it('offers no retry after a wrong code, which clears the field', async () => {
    mockVerifySignupCode.mockResolvedValue({ error: otpExpired() });
    await renderStep();

    await fireEvent.changeText(codeInput(), '482913');
    await flush();

    expect(screen.queryByText(t('common.tryAgain'))).toBeNull();
  });

  it('"already confirmed" with no password routes to sign-in', async () => {
    const { onNeedsSignIn } = await renderStep();
    await fireEvent.press(screen.getByText(t('auth.codeAlreadyConfirmed')));
    expect(onNeedsSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('"already confirmed" with a password signs in and counts the signup', async () => {
    mockSignInWithPassword.mockResolvedValue(signedIn);
    const { onNeedsSignIn } = await renderStep({ password: PASSWORD });

    await fireEvent.press(screen.getByText(t('auth.codeAlreadyConfirmed')));
    await flush();

    expect(onNeedsSignIn).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    expect(eventsNamed('EMAIL_CODE_RECOVERED')).toHaveLength(1);
    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(1);
  });

  it('resend success counts down from 60, tracks the send, and re-enables after 60 s', async () => {
    mockSendSignupCode.mockResolvedValue(ok);
    await renderStep();

    await fireEvent.press(screen.getByText(t('auth.codeResend')));
    await flush();

    expect(mockSendSignupCode).toHaveBeenCalledWith(EMAIL);
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([
      ['EMAIL_CODE_SENT', { source: EMAIL_CODE_SOURCE.RESEND }],
    ]);
    expect(screen.getByText(t('auth.codeResent'))).toBeTruthy();
    const countdown = screen.getByRole('button', { name: t('auth.codeResendIn', { seconds: 60 }) });
    expect(countdown).toBeDisabled();

    await act(async () => jest.advanceTimersByTime(60_000));
    expect(screen.getByRole('button', { name: t('auth.codeResend') })).toBeEnabled();
  });

  it('resend rate-limited 42 s shows a 42 s countdown and no error', async () => {
    mockSendSignupCode.mockResolvedValue({ error: sendRateLimited(42) });
    await renderStep();

    await fireEvent.press(screen.getByText(t('auth.codeResend')));
    await flush();

    expect(screen.getByText(t('auth.codeResendIn', { seconds: 42 }))).toBeTruthy();
    expect(screen.queryByText(t('auth.codeGenericError'))).toBeNull();
    expect(screen.queryByText(t('auth.codeConnectionError'))).toBeNull();
    expect(eventsNamed('EMAIL_CODE_SENT')).toEqual([]);
  });

  it('resend network failure leaves Resend enabled with a connection message', async () => {
    mockSendSignupCode.mockResolvedValue({ error: networkError() });
    await renderStep();

    await fireEvent.press(screen.getByText(t('auth.codeResend')));
    await flush();

    expect(screen.getByRole('button', { name: t('auth.codeResend') })).toBeEnabled();
    expect(screen.getByText(t('auth.codeConnectionError'))).toBeTruthy();
  });

  it('keeps "already confirmed" visible and enabled while the resend countdown runs', async () => {
    mockSendSignupCode.mockResolvedValue(ok);
    await renderStep();

    await fireEvent.press(screen.getByText(t('auth.codeResend')));
    await flush();

    expect(screen.getByRole('button', { name: t('auth.codeAlreadyConfirmed') })).toBeEnabled();
  });

  it('can open with the countdown already running', async () => {
    await renderStep({ initialCooldownMs: 30_000 });
    expect(screen.getByText(t('auth.codeResendIn', { seconds: 30 }))).toBeTruthy();
  });

  it('Change email calls onBack and is hidden while verifying', async () => {
    let resolveVerify: (value: typeof ok) => void = () => {};
    mockVerifySignupCode.mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );
    const { onBack } = await renderStep();

    await fireEvent.press(screen.getByText(t('auth.codeChangeEmail')));
    expect(onBack).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(codeInput(), '482913');
    expect(screen.queryByText(t('auth.codeChangeEmail'))).toBeNull();

    await act(async () => resolveVerify({ error: otpExpired() } as unknown as typeof ok));
    expect(screen.getByText(t('auth.codeChangeEmail'))).toBeTruthy();
  });
});
