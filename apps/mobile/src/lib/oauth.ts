import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import { differenceInSeconds } from 'date-fns';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

const EXPECTED_AUTH_MESSAGES = [
  'cancelled',
  'canceled',
  'authorization attempt failed for an unknown reason',
];

/** How a failed OAuth attempt is presented: silently, with a specific message, or reported. */
export const OAUTH_ERROR_KIND = {
  /** A second Google sign-in started while one was already open (double tap). Silent. */
  inProgress: 'inProgress',
  /** The device has no Google Play services (e.g. Huawei without GMS). Guide to email. */
  noPlayServices: 'noPlayServices',
  /** A normal user outcome such as cancelling. Not a bug. */
  expected: 'expected',
  /** Anything else: a real failure to report. */
  unexpected: 'unexpected',
} as const;
export type OAuthErrorKind = (typeof OAUTH_ERROR_KIND)[keyof typeof OAUTH_ERROR_KIND];

/** Thrown by `signInWithGoogle` when it is called while an earlier call is still open. */
export class GoogleSignInInProgressError extends Error {
  constructor() {
    super('Google sign-in is already in progress');
    this.name = 'GoogleSignInInProgressError';
  }
}

// Classified by the library's error CODE, not its message: the native messages are
// long, platform-specific and not stable. (MOTO-VAULT-REACT-NATIVE-A, -3H)
const GOOGLE_CODE_KIND: Readonly<Record<string, OAuthErrorKind>> = {
  [statusCodes.IN_PROGRESS]: OAUTH_ERROR_KIND.inProgress,
  [statusCodes.PLAY_SERVICES_NOT_AVAILABLE]: OAUTH_ERROR_KIND.noPlayServices,
};

export function classifyOAuthError(err: unknown): OAuthErrorKind {
  if (err instanceof GoogleSignInInProgressError) return OAUTH_ERROR_KIND.inProgress;
  if (isErrorWithCode(err)) {
    const kind = GOOGLE_CODE_KIND[String(err.code)];
    if (kind) return kind;
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return EXPECTED_AUTH_MESSAGES.some((m) => msg.includes(m))
    ? OAUTH_ERROR_KIND.expected
    : OAUTH_ERROR_KIND.unexpected;
}

/** Returns true for auth errors that are expected user-facing outcomes, not bugs. */
export function isExpectedAuthError(err: unknown): boolean {
  return classifyOAuthError(err) !== OAUTH_ERROR_KIND.unexpected;
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
 * Determine whether an OAuth sign-in just created a brand-new account, so we can
 * attribute `user_signed_up` vs `user_signed_in`. The same Apple/Google buttons
 * appear on both the login and register screens, so the screen can't tell us.
 *
 * We can't trust a single field on the `signInWithIdToken` response: in production
 * a tight `last_sign_in_at ≈ created_at` (< 5s) check mis-tagged ~80% of real
 * OAuth signups as sign-ins, because the returned user's timestamps were
 * inconsistent across providers. So we use two independent signals and treat
 * EITHER as "new":
 *   1. First-ever sign-in — `last_sign_in_at` within 30s of `created_at`
 *      (server vs server, immune to device clock skew).
 *   2. Created moments ago — `created_at` within 5 min of `now` (catches the
 *      case where `last_sign_in_at` is advanced or absent on the returned user).
 *
 * Returning users have `created_at` hours-to-days old and a large sign-in gap, so
 * neither signal fires — no false positives. Exported + `now` injectable for tests.
 */
export function isNewlyCreatedUser(
  user: Pick<User, 'created_at' | 'last_sign_in_at'> | null,
  now: Date = new Date(),
): boolean {
  if (!user?.created_at) return false;
  const created = new Date(user.created_at);
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : created;
  const firstEverSignIn = Math.abs(differenceInSeconds(lastSignIn, created)) < 30;
  const createdJustNow = differenceInSeconds(now, created) < 300;
  return firstEverSignIn || createdJustNow;
}

/**
 * Pick the user from a successful `signInWithIdToken` response. After
 * `if (error) throw error`, the SDK types narrow `data` to a non-null
 * `{ user, session }`, so `data.user` is statically always present. We still
 * fall back to `data.session.user` defensively: this is the only place that
 * decides which user object feeds new-vs-returning attribution, and keeping the
 * fallback in one spot means a single edit covers both Apple and Google. The
 * fallback is otherwise a no-op, so the cast surface is zero. (No trailing
 * `?? null` — both fields are typed non-null.)
 */
export function resolveUser(data: { user: User; session: Session }): User {
  return data.user ?? data.session.user;
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
  return { isNewUser: isNewlyCreatedUser(resolveUser(data)) };
}

// One Google sign-in at a time. A second `GoogleSignin.signIn()` while the sheet is
// open makes the native module reject the FIRST promise ("previous promise did not
// settle and was overwritten"), which the first handler then reported and alerted on
// while sign-in continued (MOTO-VAULT-REACT-NATIVE-A, double taps on Android). The
// extra call is refused before it reaches the native module, and not given the first
// call's result either: every caller tracks its own sign-in/sign-up event, so sharing
// the result would double-count it.
let googleSignInInFlight = false;

export async function signInWithGoogle(): Promise<OAuthResult> {
  if (googleSignInInFlight) throw new GoogleSignInInProgressError();
  googleSignInInFlight = true;
  try {
    return await runGoogleSignIn();
  } finally {
    googleSignInInFlight = false;
  }
}

async function runGoogleSignIn(): Promise<OAuthResult> {
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
  return { isNewUser: isNewlyCreatedUser(resolveUser(data)) };
}
