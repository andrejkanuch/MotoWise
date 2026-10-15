// Appendix C of the data-layer plan, row by row, per provider: haptic through the
// iOS-guarded wrapper, one event per resolved sign-in chosen by `isNewUser`, no
// event on a throw, and every throw presented by `presentOAuthError`.
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
import { captureException, trackEvent } from '../../lib/analytics';
import { GoogleSignInInProgressError } from '../../lib/oauth';
import { useOAuthSignIn } from '../use-oauth-sign-in';

const realPresentOAuthError: (err: unknown) => void = jest.requireActual(
  '../../lib/oauth-error-alert',
).presentOAuthError;

const track = trackEvent as jest.Mock;
const capture = captureException as jest.Mock;

const PROVIDERS = [
  { name: 'Apple', handler: 'onApple', signIn: mockSignInWithApple, method: 'apple' },
  { name: 'Google', handler: 'onGoogle', signIn: mockSignInWithGoogle, method: 'google' },
] as const;

const appleCancel = () => new Error('The user canceled the authorization attempt');
const unexpected = () => new Error('No identity token');

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

async function tap(handler: 'onApple' | 'onGoogle') {
  const { result } = await renderHook(() => useOAuthSignIn());
  await act(async () => {
    await result.current[handler]();
  });
}

describe.each(PROVIDERS)('useOAuthSignIn $name', ({ handler, signIn, method }) => {
  it('a new account fires user_signed_up once with the provider, and no sign-in', async () => {
    signIn.mockResolvedValue({ isNewUser: true });

    await tap(handler);

    expect(track.mock.calls).toEqual([['USER_SIGNED_UP', { auth_method: method }]]);
  });

  it('a returning account fires user_signed_in once with the provider, and no sign-up', async () => {
    signIn.mockResolvedValue({ isNewUser: false });

    await tap(handler);

    expect(track.mock.calls).toEqual([['USER_SIGNED_IN', { auth_method: method }]]);
  });

  it('a cancelled sign-in fires nothing and is handed to presentOAuthError', async () => {
    const err = appleCancel();
    signIn.mockRejectedValue(err);

    await tap(handler);

    expect(track).not.toHaveBeenCalled();
    expect(mockPresentOAuthError.mock.calls).toEqual([[err]]);
  });

  it('an unexpected failure fires nothing and is handed to presentOAuthError', async () => {
    const err = unexpected();
    signIn.mockRejectedValue(err);

    await tap(handler);

    expect(track).not.toHaveBeenCalled();
    expect(mockPresentOAuthError.mock.calls).toEqual([[err]]);
  });

  it('plays the haptic through triggerImpact, before the provider is called', async () => {
    signIn.mockResolvedValue({ isNewUser: false });

    await tap(handler);

    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
    expect(mockTriggerImpact.mock.invocationCallOrder[0]).toBeLessThan(
      signIn.mock.invocationCallOrder[0] as number,
    );
  });
});

describe('useOAuthSignIn Google double tap', () => {
  it('the in-progress error fires nothing, reaches presentOAuthError and shows nothing', async () => {
    const err = new GoogleSignInInProgressError();
    mockSignInWithGoogle.mockRejectedValue(err);
    mockPresentOAuthError.mockImplementation(realPresentOAuthError);

    await tap('onGoogle');

    expect(track).not.toHaveBeenCalled();
    expect(mockPresentOAuthError.mock.calls).toEqual([[err]]);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('useOAuthSignIn Apple errors through the real presentOAuthError', () => {
  // What login and register did inline before the hook: alert always, report
  // only what is not an expected outcome.
  beforeEach(() => mockPresentOAuthError.mockImplementation(realPresentOAuthError));

  it('a cancellation shows the error alert and reports nothing', async () => {
    mockSignInWithApple.mockRejectedValue(appleCancel());

    await tap('onApple');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('an unexpected failure shows the alert and reports once', async () => {
    const err = unexpected();
    mockSignInWithApple.mockRejectedValue(err);

    await tap('onApple');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls).toEqual([[err]]);
    expect(track).not.toHaveBeenCalled();
  });
});
