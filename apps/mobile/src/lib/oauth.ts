import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import type { User } from '@supabase/supabase-js';
import { differenceInSeconds } from 'date-fns';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

const EXPECTED_AUTH_MESSAGES = [
  'cancelled',
  'canceled',
  'authorization attempt failed for an unknown reason',
];

/** Returns true for auth errors that are expected user-facing outcomes, not bugs. */
export function isExpectedAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return EXPECTED_AUTH_MESSAGES.some((m) => msg.includes(m));
}

/**
 * Report an OAuth error to crash reporting only when it is NOT an expected
 * user outcome (cancellation, Apple's generic "unknown reason"). Both the
 * login and register screens route through this so neither can drift into
 * reporting expected failures as bugs. (MOTO-VAULT-REACT-NATIVE-C)
 *
 * @param report the crash reporter (e.g. `captureException` from analytics);
 *   injected so this module stays decoupled from the analytics layer.
 */
export function reportUnexpectedAuthError(err: unknown, report: (e: unknown) => void): void {
  if (!isExpectedAuthError(err)) report(err);
}

/** Result of an OAuth sign-in, used to attribute user_signed_up vs user_signed_in correctly. */
export type OAuthResult = { isNewUser: boolean };

/**
 * A freshly-created OAuth user has `created_at` within a few seconds of `last_sign_in_at`.
 * Using the auth result (not which screen the button was on) is the only reliable way to
 * tell signups from returning sign-ins — the same Apple/Google buttons appear on both screens.
 */
function isNewlyCreatedUser(user: User | null): boolean {
  if (!user?.created_at) return false;
  const created = new Date(user.created_at);
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : created;
  return Math.abs(differenceInSeconds(lastSignIn, created)) < 5;
}

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export async function signInWithApple(): Promise<OAuthResult> {
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('No identity token');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce,
  });
  if (error) throw error;
  return { isNewUser: isNewlyCreatedUser(data.user) };
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in was cancelled');
  }

  const idToken = response.data.idToken;
  if (!idToken) throw new Error('No ID token from Google Sign-In');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return { isNewUser: isNewlyCreatedUser(data.user) };
}
