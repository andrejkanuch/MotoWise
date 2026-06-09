jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: jest.fn(),
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(), digestStringAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('../supabase', () => ({ supabase: { auth: { signInWithIdToken: jest.fn() } } }));

import type { User } from '@supabase/supabase-js';
import { isExpectedAuthError, isNewlyCreatedUser, reportUnexpectedAuthError } from '../oauth';

const NOW = new Date('2026-06-09T12:00:00.000Z');
const user = (created: string, lastSignIn: string | null): User =>
  ({ created_at: created, last_sign_in_at: lastSignIn }) as User;

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
    expect(isNewlyCreatedUser({ last_sign_in_at: NOW.toISOString() } as User, NOW)).toBe(false);
  });

  it('returns false for null user', () => {
    expect(isNewlyCreatedUser(null, NOW)).toBe(false);
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
