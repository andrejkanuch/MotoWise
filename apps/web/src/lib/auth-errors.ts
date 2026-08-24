// Maps raw Supabase auth error strings to human sign-in messages, so the login
// page and auth modal never show a database string like "Invalid login
// credentials" or "missing email or phone" to a rider.

/** Extra recovery step to offer next to an error message. */
export type AuthErrorRecovery = 'resend_confirmation' | 'reset_password' | null;

export interface AuthErrorInfo {
  message: string;
  /** Intrinsic recovery for this error, independent of how many times it happened. */
  recovery: AuthErrorRecovery;
}

/** Message shown when a field is empty, before any network call. */
export const EMPTY_FIELDS_MESSAGE = 'Enter your email and password to sign in.';

/** True when both fields carry a value the network call can use. */
export function hasCredentials(email: string, password: string): boolean {
  return email.trim().length > 0 && password.length > 0;
}

/** Shape of a Supabase auth error — its stable `code` plus the raw message. */
export interface SupabaseAuthError {
  code?: string | null;
  message: string;
}

/**
 * Turn a Supabase auth error into a rider-facing one. Branches on the stable
 * `error.code` first (the message text is not a Supabase contract), and falls
 * back to matching the message when no code is present.
 * - "invalid_credentials" also nudges toward Google / Apple sign-in.
 * - "email_not_confirmed" offers to resend the confirmation email.
 * Unknown errors pass their message through unchanged.
 */
export function humanizeAuthError(error: SupabaseAuthError): AuthErrorInfo {
  const code = error.code ?? '';
  const text = error.message.toLowerCase();

  if (code === 'email_not_confirmed' || text.includes('not confirmed')) {
    return {
      message: 'Your email is not confirmed yet. Open the link we sent you, or resend it below.',
      recovery: 'resend_confirmation',
    };
  }

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return {
      message:
        'That email and password do not match. If you signed up with Google or Apple, use one of those buttons above.',
      recovery: null,
    };
  }

  if (text.includes('missing email') || text.includes('missing password')) {
    return { message: EMPTY_FIELDS_MESSAGE, recovery: null };
  }

  return { message: error.message, recovery: null };
}

/**
 * Recovery step to show in the error box. Reset password is promoted after two
 * or more failures in a row, unless the error already has its own recovery.
 */
export function recoveryForAttempt(info: AuthErrorInfo, failedAttempts: number): AuthErrorRecovery {
  if (info.recovery) return info.recovery;
  return failedAttempts >= 2 ? 'reset_password' : null;
}
