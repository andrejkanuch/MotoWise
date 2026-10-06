import { safeRedirectPath } from '@/lib/safe-redirect';

/**
 * Where a rider lands after authenticating on the web.
 *
 * - A rider's FIRST session (just signed up: email confirmed, first Google /
 *   Apple login, or an instant sign-up when confirmations are off) lands on
 *   the post-signup "Get the app" screen, `/welcome`.
 * - Every later sign-in lands on `/garage`, as before.
 * - An explicit `?redirect=` (e.g. `/pro/checkout`, `/reset-password`, or the
 *   page the auth modal was opened on) always wins, first session or not:
 *   the rider had an intent, and a checkout or password reset must never be
 *   interrupted. `/welcome` only replaces the DEFAULT landing.
 *
 * "First session" uses signals Supabase already returns on the user (no DB
 * column, nothing passed through the URL): the account was created, or its
 * email was confirmed, moments ago. `last_sign_in_at` is deliberately not
 * used: whether the exchange response already carries the new value is a
 * GoTrue implementation detail.
 */

export const WELCOME_PATH = '/welcome';
export const DEFAULT_POST_AUTH_PATH = '/garage';

/**
 * How recent `created_at` / `email_confirmed_at` must be to count as the
 * first session. Generous enough for a slow OAuth round trip, a confirmation
 * opened a few minutes after it arrived, and Supabase ↔ Vercel clock skew;
 * short enough that a returning rider never sees the welcome screen again.
 */
export const FIRST_SESSION_WINDOW_MS = 10 * 60 * 1000;

/** The subset of the Supabase `User` this decision reads. */
export type AuthUserTimestamps = {
  created_at?: string | null;
  email_confirmed_at?: string | null;
};

function isWithinWindow(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return false;
  // Absolute: a timestamp slightly in the future is clock skew, not a bug.
  return Math.abs(now - at) <= FIRST_SESSION_WINDOW_MS;
}

/**
 * True when this sign-in is the rider's first: the account was created
 * (instant sign-up, first OAuth login) or its email confirmed (the
 * confirmation link) within {@link FIRST_SESSION_WINDOW_MS} of `now`.
 * A missing user, or unparseable timestamps, read as "returning".
 */
export function isFirstSession(
  user: AuthUserTimestamps | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!user) return false;
  return isWithinWindow(user.created_at, now) || isWithinWindow(user.email_confirmed_at, now);
}

/**
 * The same-origin path to send a rider to after authenticating. `redirect` is
 * the raw `?redirect=` value (untrusted; sanitised by `safeRedirectPath`).
 */
export function postAuthDestination({
  redirect,
  user,
  now = Date.now(),
}: {
  redirect: string | null | undefined;
  user: AuthUserTimestamps | null | undefined;
  now?: number;
}): string {
  const destination = safeRedirectPath(redirect, DEFAULT_POST_AUTH_PATH);
  if (destination !== DEFAULT_POST_AUTH_PATH) return destination;
  return isFirstSession(user, now) ? WELCOME_PATH : DEFAULT_POST_AUTH_PATH;
}

/**
 * `emailRedirectTo` for `supabase.auth.signUp`: the confirmation link comes
 * back through `/auth/callback` (which exchanges the code and applies
 * {@link postAuthDestination}) instead of the bare site URL, carrying the
 * rider's `?redirect=` along.
 */
export function signUpEmailRedirectTo(origin: string, redirect: string | null | undefined): string {
  const destination = safeRedirectPath(redirect, DEFAULT_POST_AUTH_PATH);
  return `${origin}/auth/callback?redirect=${encodeURIComponent(destination)}`;
}
