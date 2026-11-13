// Appendix C of the data-layer plan, row by row, per provider: haptic through the
// iOS-guarded wrapper, one sign-up/sign-in event per resolved sign-in chosen by
// `isNewUser`, none on a throw, and every throw presented by `presentOAuthError`.
// issue 365 T04a (FS-OB2a/c): every tap is exactly one `auth_oauth_started` and one
// `auth_oauth_result` with typed properties, whatever the outcome.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: jest.fn(),
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e !== null && 'code' in e,
  statusCodes: {
    IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    NULL_PRESENTER: 'NULL_PRESENTER',
  },
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({}));

const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();
jest.mock('../../lib/oauth', () => ({
  ...jest.requireActual('../../lib/oauth'),
  signInWithApple: (...args: unknown[]) => mockSignInWithApple(...args),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));

const mockPresentOAuthError = jest.fn();
jest.mock('../../lib/oauth-error-alert', () => ({
  presentOAuthError: (...args: unknown[]) => mockPresentOAuthError(...args),
}));
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
const mockTriggerImpact = jest.fn();
jest.mock('../../utils/haptics', () => ({
  triggerImpact: (...args: unknown[]) => mockTriggerImpact(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AUTH_SURFACE, type AuthSurface } from '../../config/auth';
import { captureException, trackEvent } from '../../lib/analytics';
import { GoogleSignInInProgressError, type OAuthMarks } from '../../lib/oauth';
import { useOAuthSignIn } from '../use-oauth-sign-in';

const realPresentOAuthError: (err: unknown, provider: string) => void = jest.requireActual(
  '../../lib/oauth-error-alert',
).presentOAuthError;

const track = trackEvent as jest.Mock;
const capture = captureException as jest.Mock;

const PROVIDERS = [
  { name: 'Apple', handler: 'onApple', signIn: mockSignInWithApple, method: 'apple' },
  { name: 'Google', handler: 'onGoogle', signIn: mockSignInWithGoogle, method: 'google' },
] as const;

const SURFACE = AUTH_SURFACE.ONBOARDING_ACCOUNT;
const STARTED_AT = 1_700_000_000_000;
const SHEET_MS = 1_200;
const EXCHANGE_MS = 300;

const appleCancel = () =>
  Object.assign(new Error('The user canceled the authorization attempt'), {
    code: 'ERR_REQUEST_CANCELED',
  });
const unexpected = () => new Error('No identity token');
// What supabase-js throws when the token exchange cannot reach the server.
const networkError = () =>
  Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError' });

/** The provider's sheet takes SHEET_MS, then the token exchange EXCHANGE_MS and resolves. */
const resolvesAfterSheet =
  (isNewUser: boolean) =>
  async (marks: OAuthMarks): Promise<{ isNewUser: boolean }> => {
    jest.setSystemTime(STARTED_AT + SHEET_MS);
    marks.onSheetDone();
    jest.setSystemTime(STARTED_AT + SHEET_MS + EXCHANGE_MS);
    return { isNewUser };
  };

/** The sheet closes without a token after SHEET_MS (a cancel, no Play services, …). */
const throwsInSheet = (err: unknown) => async (): Promise<never> => {
  jest.setSystemTime(STARTED_AT + SHEET_MS);
  throw err;
};

/** The sheet returned a token, then the Supabase exchange failed. */
const throwsInExchange =
  (err: unknown) =>
  async (marks: OAuthMarks): Promise<never> => {
    jest.setSystemTime(STARTED_AT + SHEET_MS);
    marks.onSheetDone();
    jest.setSystemTime(STARTED_AT + SHEET_MS + EXCHANGE_MS);
    throw err;
  };

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: STARTED_AT });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

async function tap(handler: 'onApple' | 'onGoogle', surface: AuthSurface = SURFACE) {
  const { result } = await renderHook(() => useOAuthSignIn(surface));
  await act(async () => {
    await result.current[handler]();
  });
}

function eventsNamed(name: string) {
  return track.mock.calls.filter(([event]) => event === name);
}

describe.each(PROVIDERS)('useOAuthSignIn $name', ({ handler, signIn, method }) => {
  it('a new account: started, user_signed_up with the surface, result success', async () => {
    signIn.mockImplementation(resolvesAfterSheet(true));

    await tap(handler);

    expect(track.mock.calls).toEqual([
      ['AUTH_OAUTH_STARTED', { provider: method, surface: SURFACE }],
      ['USER_SIGNED_UP', { auth_method: method, surface: SURFACE }],
      [
        'AUTH_OAUTH_RESULT',
        {
          provider: method,
          surface: SURFACE,
          outcome: 'success',
          stage: 'token_exchange',
          duration_ms: SHEET_MS + EXCHANGE_MS,
          is_new_user: true,
          error_code: null,
        },
      ],
    ]);
  });

  it('a returning account: started, user_signed_in with the surface, result success', async () => {
    signIn.mockImplementation(resolvesAfterSheet(false));

    await tap(handler, AUTH_SURFACE.LOGIN);

    expect(track.mock.calls).toEqual([
      ['AUTH_OAUTH_STARTED', { provider: method, surface: AUTH_SURFACE.LOGIN }],
      ['USER_SIGNED_IN', { auth_method: method, surface: AUTH_SURFACE.LOGIN }],
      [
        'AUTH_OAUTH_RESULT',
        expect.objectContaining({ outcome: 'success', is_new_user: false, error_code: null }),
      ],
    ]);
  });

  it('a cancel: one started, one result {cancelled, sheet} with the code only, handed to presentOAuthError', async () => {
    const err = appleCancel();
    signIn.mockImplementation(throwsInSheet(err));

    await tap(handler);

    expect(track.mock.calls).toEqual([
      ['AUTH_OAUTH_STARTED', { provider: method, surface: SURFACE }],
      [
        'AUTH_OAUTH_RESULT',
        {
          provider: method,
          surface: SURFACE,
          outcome: 'cancelled',
          stage: 'sheet',
          duration_ms: SHEET_MS,
          is_new_user: null,
          error_code: 'ERR_REQUEST_CANCELED',
        },
      ],
    ]);
    expect(mockPresentOAuthError.mock.calls).toEqual([[err, method]]);
  });

  it('a network failure in the token exchange: result {error, token_exchange}, no message in properties', async () => {
    const err = networkError();
    signIn.mockImplementation(throwsInExchange(err));

    await tap(handler);

    expect(eventsNamed('AUTH_OAUTH_STARTED')).toHaveLength(1);
    expect(eventsNamed('AUTH_OAUTH_RESULT')).toEqual([
      [
        'AUTH_OAUTH_RESULT',
        {
          provider: method,
          surface: SURFACE,
          outcome: 'error',
          stage: 'token_exchange',
          duration_ms: SHEET_MS + EXCHANGE_MS,
          is_new_user: null,
          error_code: 'AuthRetryableFetchError',
        },
      ],
    ]);
    expect(JSON.stringify(track.mock.calls)).not.toContain('Network request failed');
    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(0);
    expect(eventsNamed('USER_SIGNED_IN')).toHaveLength(0);
    expect(mockPresentOAuthError.mock.calls).toEqual([[err, method]]);
  });

  it('an unexpected failure is handed to presentOAuthError and fires no sign-up or sign-in', async () => {
    const err = unexpected();
    signIn.mockRejectedValue(err);

    await tap(handler);

    expect(eventsNamed('USER_SIGNED_UP')).toHaveLength(0);
    expect(eventsNamed('USER_SIGNED_IN')).toHaveLength(0);
    expect(eventsNamed('AUTH_OAUTH_RESULT')).toEqual([
      ['AUTH_OAUTH_RESULT', expect.objectContaining({ outcome: 'error', stage: 'sheet' })],
    ]);
    expect(mockPresentOAuthError.mock.calls).toEqual([[err, method]]);
  });

  it('plays the haptic and fires auth_oauth_started before the provider is called', async () => {
    signIn.mockResolvedValue({ isNewUser: false });

    await tap(handler);

    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
    const providerCall = signIn.mock.invocationCallOrder[0] as number;
    expect(mockTriggerImpact.mock.invocationCallOrder[0]).toBeLessThan(providerCall);
    expect(track.mock.invocationCallOrder[0]).toBeLessThan(providerCall);
    expect(track.mock.calls[0]?.[0]).toBe('AUTH_OAUTH_STARTED');
  });
});

describe('useOAuthSignIn Google double tap', () => {
  it('the in-progress error: one started, one result {in_progress}, nothing shown', async () => {
    const err = new GoogleSignInInProgressError();
    mockSignInWithGoogle.mockRejectedValue(err);
    mockPresentOAuthError.mockImplementation(realPresentOAuthError);

    await tap('onGoogle');

    expect(track.mock.calls).toEqual([
      ['AUTH_OAUTH_STARTED', { provider: 'google', surface: SURFACE }],
      [
        'AUTH_OAUTH_RESULT',
        expect.objectContaining({
          provider: 'google',
          outcome: 'in_progress',
          stage: 'sheet',
          is_new_user: null,
          error_code: 'GoogleSignInInProgressError',
        }),
      ],
    ]);
    expect(mockPresentOAuthError.mock.calls).toEqual([[err, 'google']]);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('no Play services: result {no_play_services} with the library code', async () => {
    mockSignInWithGoogle.mockRejectedValue(
      Object.assign(new Error('Play services not available or outdated'), {
        code: 'PLAY_SERVICES_NOT_AVAILABLE',
      }),
    );

    await tap('onGoogle');

    expect(eventsNamed('AUTH_OAUTH_RESULT')).toEqual([
      [
        'AUTH_OAUTH_RESULT',
        expect.objectContaining({
          outcome: 'no_play_services',
          error_code: 'PLAY_SERVICES_NOT_AVAILABLE',
        }),
      ],
    ]);
  });

  it('a sheet the OS would not open: result {cannot_present}', async () => {
    mockSignInWithGoogle.mockRejectedValue(
      Object.assign(new Error('presenter is null'), { code: 'NULL_PRESENTER' }),
    );

    await tap('onGoogle');

    expect(eventsNamed('AUTH_OAUTH_RESULT')).toEqual([
      ['AUTH_OAUTH_RESULT', expect.objectContaining({ outcome: 'cannot_present' })],
    ]);
  });
});

describe('useOAuthSignIn errors through the real presentOAuthError', () => {
  // What login and register did inline before the hook: alert always, report
  // only what is not an expected outcome. issue 365 T04a: every alert shown is also
  // one `auth_error_alert_shown` (FS-OB2c's numerator).
  beforeEach(() => mockPresentOAuthError.mockImplementation(realPresentOAuthError));

  it('a cancellation shows the error alert, counts it, and reports nothing', async () => {
    mockSignInWithApple.mockRejectedValue(appleCancel());

    await tap('onApple');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
    expect(eventsNamed('AUTH_ERROR_ALERT_SHOWN')).toEqual([
      [
        'AUTH_ERROR_ALERT_SHOWN',
        { provider: 'apple', outcome: 'cancelled', error_code: 'ERR_REQUEST_CANCELED' },
      ],
    ]);
    expect(eventsNamed('USER_SIGNED_IN')).toHaveLength(0);
  });

  it('an unexpected failure shows the alert, counts it, and reports once', async () => {
    const err = unexpected();
    mockSignInWithApple.mockRejectedValue(err);

    await tap('onApple');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls).toEqual([[err]]);
    expect(eventsNamed('AUTH_ERROR_ALERT_SHOWN')).toEqual([
      ['AUTH_ERROR_ALERT_SHOWN', { provider: 'apple', outcome: 'error', error_code: 'Error' }],
    ]);
    expect(eventsNamed('USER_SIGNED_IN')).toHaveLength(0);
  });
});

describe('useOAuthSignIn in-flight guard (issue 365 T11)', () => {
  beforeEach(() => {
    mockSignInWithApple.mockReset();
    mockSignInWithGoogle.mockReset();
  });

  /** A provider call that stays pending until the returned `resolve` runs. */
  function pendingSignIn(signIn: jest.Mock) {
    let resolve: (value: { isNewUser: boolean }) => void = () => {};
    signIn.mockImplementation(
      () =>
        new Promise<{ isNewUser: boolean }>((r) => {
          resolve = r;
        }),
    );
    return () => resolve({ isNewUser: false });
  }

  it.each(
    PROVIDERS,
  )('a second $name tap while the first is pending makes no second provider call and no events', async ({
    handler,
    signIn,
  }) => {
    const finish = pendingSignIn(signIn);
    const { result } = await renderHook(() => useOAuthSignIn(SURFACE));

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current[handler]();
      await result.current[handler]();
    });

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
    expect(eventsNamed('AUTH_OAUTH_STARTED')).toHaveLength(1);

    await act(async () => {
      finish();
      await first;
    });
    expect(eventsNamed('AUTH_OAUTH_RESULT')).toHaveLength(1);
  });

  it('the guard spans providers and screens: Google while Apple is pending is ignored', async () => {
    const finish = pendingSignIn(mockSignInWithApple);
    const { result } = await renderHook(() => ({
      signInScreen: useOAuthSignIn(AUTH_SURFACE.ONBOARDING_SIGN_IN),
      accountScreen: useOAuthSignIn(SURFACE),
    }));

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.signInScreen.onApple();
      await result.current.accountScreen.onGoogle();
    });

    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      await first;
    });
  });

  it('a tap after the first one settles goes through again', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(appleCancel());
    mockSignInWithGoogle.mockResolvedValueOnce({ isNewUser: false });

    const { result } = await renderHook(() => useOAuthSignIn(SURFACE));
    await act(async () => {
      await result.current.onGoogle();
    });
    await act(async () => {
      await result.current.onGoogle();
    });

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(2);
    expect(eventsNamed('AUTH_OAUTH_RESULT')).toHaveLength(2);
  });
});
