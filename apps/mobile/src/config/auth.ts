/**
 * Where Supabase sends a rider after an app-requested confirmation email.
 *
 * Every app `signUp` and `resend` MUST pass this exact value: the production
 * "Confirm signup" template (`supabase/templates/confirmation.html`) compares
 * `{{ .RedirectTo }}` to it byte for byte to send the code-first app email.
 * Any other value falls back to the web link-only email, which has no code.
 * Guarded by `lib/__tests__/auth-email-contract.test.ts`.
 */
export const AUTH_EMAIL_REDIRECT_TO =
  'https://motovault.app/auth/callback?redirect=motovault://auth/callback';

/** Digits in the email confirmation code. Matches production `mailer_otp_length`. */
export const EMAIL_OTP_LENGTH = 6;

/**
 * How long Resend stays disabled after a code is sent. Matches Supabase's
 * per-address email limit (`max_frequency`), so a resend after the wait is not
 * rejected as too frequent.
 */
export const RESEND_COOLDOWN_MS = 60_000;

/** Supabase auth error codes the email-confirmation flow branches on. */
export const AUTH_ERROR_CODE = {
  EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
  OTP_EXPIRED: 'otp_expired',
  OVER_EMAIL_SEND_RATE_LIMIT: 'over_email_send_rate_limit',
  OVER_REQUEST_RATE_LIMIT: 'over_request_rate_limit',
} as const;
