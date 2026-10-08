import { type AuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { AUTH_EMAIL_REDIRECT_TO, AUTH_ERROR_CODE, RESEND_COOLDOWN_MS } from '../config/auth';
import { supabase } from './supabase';

// The only callers of `auth.resend` and `auth.verifyOtp` in the app. Keeping them
// here is what guarantees every app-requested email carries
// AUTH_EMAIL_REDIRECT_TO, and so gets the code-first template branch.

/** What went wrong with a sign-in, send or verify, in the terms the UI acts on. */
export const EMAIL_AUTH_ERROR = {
  NOT_CONFIRMED: 'not_confirmed',
  INVALID_OR_EXPIRED: 'invalid_or_expired',
  RATE_LIMITED: 'rate_limited',
  THROTTLED: 'throttled',
  NETWORK: 'network',
  GENERIC: 'generic',
} as const;

export type EmailAuthErrorKind = (typeof EMAIL_AUTH_ERROR)[keyof typeof EMAIL_AUTH_ERROR];

export type ClassifiedAuthError =
  | { kind: typeof EMAIL_AUTH_ERROR.RATE_LIMITED; retryAfterMs: number }
  | { kind: Exclude<EmailAuthErrorKind, typeof EMAIL_AUTH_ERROR.RATE_LIMITED> };

export interface EmailAuthResult {
  error: AuthError | null;
}

/**
 * Supabase lowercases emails on signup and verify, but does not trim them. An
 * autofilled trailing space would otherwise make the verify look up a different
 * address than the one the code was sent to.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Send a fresh signup code. Each send replaces the previous code. */
export async function sendSignupCode(email: string): Promise<EmailAuthResult> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
    options: { emailRedirectTo: AUTH_EMAIL_REDIRECT_TO },
  });
  return { error };
}

/** Confirm the account with the emailed code. Success creates the session. */
export async function verifySignupCode(email: string, code: string): Promise<EmailAuthResult> {
  const { error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: code,
    type: 'email',
  });
  return { error };
}

const RETRY_AFTER_SECONDS = /after (\d+) seconds?/i;

function retryAfterMs(message: string): number {
  const match = RETRY_AFTER_SECONDS.exec(message);
  return match ? Number(match[1]) * 1000 : RESEND_COOLDOWN_MS;
}

function isNetworkError(error: unknown): boolean {
  return (
    isAuthRetryableFetchError(error) ||
    (error instanceof TypeError && /network|fetch/i.test(error.message))
  );
}

/**
 * Map a Supabase auth error to what the code step should do. Branches on the
 * stable `code` first; the message is only a fallback because its text is not a
 * Supabase contract (same approach as web's `humanizeAuthError`).
 */
export function classifyAuthError(error: unknown): ClassifiedAuthError {
  if (isNetworkError(error)) return { kind: EMAIL_AUTH_ERROR.NETWORK };

  const code = (error as { code?: string } | null)?.code ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';

  if (code === AUTH_ERROR_CODE.EMAIL_NOT_CONFIRMED || /not confirmed/i.test(message)) {
    return { kind: EMAIL_AUTH_ERROR.NOT_CONFIRMED };
  }
  if (code === AUTH_ERROR_CODE.OTP_EXPIRED) {
    return { kind: EMAIL_AUTH_ERROR.INVALID_OR_EXPIRED };
  }
  if (code === AUTH_ERROR_CODE.OVER_EMAIL_SEND_RATE_LIMIT) {
    return { kind: EMAIL_AUTH_ERROR.RATE_LIMITED, retryAfterMs: retryAfterMs(message) };
  }
  if (code === AUTH_ERROR_CODE.OVER_REQUEST_RATE_LIMIT) {
    return { kind: EMAIL_AUTH_ERROR.THROTTLED };
  }
  return { kind: EMAIL_AUTH_ERROR.GENERIC };
}
