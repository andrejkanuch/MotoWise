// Native code constants come from the module at runtime; mirror the Android values.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: jest.fn(),
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e !== null && 'code' in e,
  statusCodes: {
    SIGN_IN_CANCELLED: '12501',
    IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(), digestStringAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('../supabase', () => ({ supabase: { auth: { signInWithIdToken: jest.fn() } } }));

import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import {
  classifyOAuthError,
  GoogleSignInInProgressError,
  isExpectedAuthError,
  isNewlyCreatedUser,
  OAUTH_ERROR_KIND,
  reportUnexpectedAuthError,
  resolveUser,
  signInWithGoogle,
} from '../oauth';

const NOW = new Date('2026-06-09T12:00:00.000Z');
const user = (created: string, lastSignIn: string | null) => ({
  created_at: created,
  last_sign_in_at: lastSignIn,
});

describe('isExpectedAuthError', () => {
  it('returns true for Apple "cancelled" error', () => {
    expect(isExpectedAuthError(new Error('The operation was cancelled'))).toBe(true);
  });

  it('returns true for Google "canceled" error (American spelling)', () => {
    expect(isExpectedAuthError(new Error('Sign in canceled'))).toBe(true);
  });

  it('returns true for Apple "authorization attempt failed for an unknown reason"', () => {
    expect(
      isExpectedAuthError(new Error('The authorization attempt failed for an unknown reason')),
    ).toBe(true);
  });

  it('returns false for network errors', () => {
    expect(isExpectedAuthError(new Error('Network request failed'))).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(isExpectedAuthError(new Error('Something went wrong'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isExpectedAuthError('not an error')).toBe(false);
    expect(isExpectedAuthError(null)).toBe(false);
    expect(isExpectedAuthError(undefined)).toBe(false);
  });

  it('returns false for Error with no message', () => {
    expect(isExpectedAuthError(new Error())).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(
      isExpectedAuthError(new Error('THE AUTHORIZATION ATTEMPT FAILED FOR AN UNKNOWN REASON')),
    ).toBe(true);
    expect(isExpectedAuthError(new Error('CANCELLED'))).toBe(true);
  });
});

describe('isNewlyCreatedUser', () => {
  it('returns true when last_sign_in_at equals created_at (first-ever sign-in)', () => {
    expect(
      isNewlyCreatedUser(user('2026-06-09T11:59:59.000Z', '2026-06-09T11:59:59.000Z'), NOW),
    ).toBe(true);
  });

  it('returns true when last_sign_in_at is null (no prior sign-in) but created just now', () => {
    expect(isNewlyCreatedUser(user('2026-06-09T11:59:58.000Z', null), NOW)).toBe(true);
  });

  it('returns true when created moments ago even if last_sign_in_at is advanced (the prod bug)', () => {
    // Returned object had last_sign_in_at 40s after created — old 5s check failed here.
    expect(
      isNewlyCreatedUser(user('2026-06-09T11:59:20.000Z', '2026-06-09T12:00:00.000Z'), NOW),
    ).toBe(true);
  });

  it('returns false for a returning user (old account, recent sign-in)', () => {
    expect(
      isNewlyCreatedUser(user('2026-03-01T10:00:00.000Z', '2026-06-09T12:00:00.000Z'), NOW),
    ).toBe(false);
  });

  it('returns false when created_at is missing', () => {
    expect(isNewlyCreatedUser({ created_at: '', last_sign_in_at: NOW.toISOString() }, NOW)).toBe(
      false,
    );
  });

  it('returns false for null user', () => {
    expect(isNewlyCreatedUser(null, NOW)).toBe(false);
  });

  it('defaults `now` to the current time when omitted (created just now => true)', () => {
    expect(isNewlyCreatedUser(user(new Date().toISOString(), null))).toBe(true);
  });
});

describe('resolveUser', () => {
  it('falls back to data.session.user when data.user is null', () => {
    const sessionUser = { created_at: '2026-06-09T11:59:59.000Z' } as User;
    // data.user is typed non-null by the SDK, but resolveUser defends against a
    // runtime null by falling back to the session user — assert that path.
    const data = { user: null as unknown as User, session: { user: sessionUser } as Session };
    expect(resolveUser(data)).toBe(sessionUser);
  });

  it('prefers data.user when present', () => {
    const directUser = { created_at: '2026-06-09T11:59:59.000Z' } as User;
    const sessionUser = { created_at: '2026-01-01T00:00:00.000Z' } as User;
    const data = { user: directUser, session: { user: sessionUser } as Session };
    expect(resolveUser(data)).toBe(directUser);
  });
});

describe('reportUnexpectedAuthError', () => {
  it('reports genuine failures (network) to the reporter', () => {
    const report = jest.fn();
    reportUnexpectedAuthError(new Error('Network request failed'), report);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('does NOT report Apple\'s "unknown reason" — the source of MOTO-VAULT-REACT-NATIVE-C', () => {
    const report = jest.fn();
    reportUnexpectedAuthError(
      new Error('The authorization attempt failed for an unknown reason'),
      report,
    );
    expect(report).not.toHaveBeenCalled();
  });

  it('does NOT report user cancellations', () => {
    const report = jest.fn();
    reportUnexpectedAuthError(new Error('The operation was cancelled'), report);
    expect(report).not.toHaveBeenCalled();
  });

  it('passes the original error through to the reporter unchanged', () => {
    const report = jest.fn();
    const err = new Error('Something went wrong');
    reportUnexpectedAuthError(err, report);
    expect(report).toHaveBeenCalledWith(err);
  });
});

const codeError = (code: string) => Object.assign(new Error(`native ${code}`), { code });

describe('classifyOAuthError', () => {
  it('treats the native IN_PROGRESS code (Android double tap) as in-progress, by code', () => {
    expect(classifyOAuthError(codeError('ASYNC_OP_IN_PROGRESS'))).toBe(OAUTH_ERROR_KIND.inProgress);
  });

  it('treats a missing Play services device as noPlayServices, not a bug', () => {
    const err = codeError('PLAY_SERVICES_NOT_AVAILABLE');
    expect(classifyOAuthError(err)).toBe(OAUTH_ERROR_KIND.noPlayServices);
    expect(isExpectedAuthError(err)).toBe(true);
  });

  it('treats our own in-flight guard error as in-progress', () => {
    expect(classifyOAuthError(new GoogleSignInInProgressError())).toBe(OAUTH_ERROR_KIND.inProgress);
  });

  it('falls back to the message rules for codes it does not know', () => {
    expect(classifyOAuthError(codeError('SOMETHING_ELSE'))).toBe(OAUTH_ERROR_KIND.unexpected);
    expect(classifyOAuthError(new Error('Sign in canceled'))).toBe(OAUTH_ERROR_KIND.expected);
  });
});

// MOTO-VAULT-REACT-NATIVE-A: a second signIn() while the sheet is open made the
// native module reject the first call.
describe('signInWithGoogle in-flight guard', () => {
  it('refuses a second call while the first is open, without touching the native module', async () => {
    let finishSignIn: (v: unknown) => void = () => {};
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
    (GoogleSignin.signIn as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((r) => {
          finishSignIn = r;
        }),
    );
    (isSuccessResponse as unknown as jest.Mock).mockReturnValue(false);

    const first = signInWithGoogle();
    await expect(signInWithGoogle()).rejects.toBeInstanceOf(GoogleSignInInProgressError);
    expect(GoogleSignin.signIn).toHaveBeenCalledTimes(1);

    finishSignIn({ type: 'cancelled' });
    await expect(first).rejects.toThrow('cancelled');

    // Released once the first call settles.
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'cancelled' });
    await expect(signInWithGoogle()).rejects.toThrow('cancelled');
    expect(GoogleSignin.signIn).toHaveBeenCalledTimes(2);
  });
});
