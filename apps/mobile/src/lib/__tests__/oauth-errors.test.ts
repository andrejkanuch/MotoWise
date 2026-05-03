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

import { isExpectedAuthError } from '../oauth';

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
