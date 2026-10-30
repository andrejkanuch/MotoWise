/**
 * The one query parameter /auth/callback and /login share: a failure the
 * callback cannot recover from (no code, or an expired / already-used
 * confirmation link) is handed to /login as `?error=<code>`, and /login turns
 * the code into its banner copy (AuthV2.signIn.<code>). Both sides read the
 * names from here so neither can drift.
 */

export const AUTH_ERROR_PARAM = 'error';

export const AuthErrorCode = {
  /** The confirmation or recovery link expired, was reused, or carried no code. */
  LinkExpired: 'link_expired',
} as const;
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/** AuthV2 `signIn.*` message key for each error code. */
export const AUTH_ERROR_MESSAGE_KEY = {
  [AuthErrorCode.LinkExpired]: 'signIn.linkExpired',
} as const satisfies Record<AuthErrorCode, string>;

const CODES: ReadonlySet<string> = new Set(Object.values(AuthErrorCode));

/** Same-origin path of /login carrying the error code. */
export function loginErrorPath(code: AuthErrorCode): string {
  return `/login?${AUTH_ERROR_PARAM}=${code}`;
}

/** The error code in a `window.location.search` string, or null when absent or unknown. */
export function readAuthErrorCode(search: string): AuthErrorCode | null {
  const value = new URLSearchParams(search).get(AUTH_ERROR_PARAM);
  return value !== null && CODES.has(value) ? (value as AuthErrorCode) : null;
}
