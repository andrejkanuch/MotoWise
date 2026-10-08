jest.mock('../supabase', () => ({
  supabase: { auth: { resend: jest.fn(), verifyOtp: jest.fn() } },
}));

import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { AUTH_EMAIL_REDIRECT_TO, RESEND_COOLDOWN_MS } from '../../config/auth';
import {
  classifyAuthError,
  EMAIL_AUTH_ERROR,
  normalizeEmail,
  sendSignupCode,
  verifySignupCode,
} from '../email-confirmation';
import { supabase } from '../supabase';

const resend = supabase.auth.resend as jest.Mock;
const verifyOtp = supabase.auth.verifyOtp as jest.Mock;

const apiError = (message: string, status: number, code?: string) =>
  new AuthApiError(message, status, code);

beforeEach(() => {
  resend.mockReset();
  verifyOtp.mockReset();
});

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases, matching what Supabase stores', () => {
    expect(normalizeEmail('  Rider@Example.COM \n')).toBe('rider@example.com');
  });
});

describe('sendSignupCode', () => {
  it('resends a signup code to the normalized email with the app redirect', async () => {
    resend.mockResolvedValue({ data: {}, error: null });

    const result = await sendSignupCode(' Rider@Example.com ');

    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'rider@example.com',
      options: { emailRedirectTo: AUTH_EMAIL_REDIRECT_TO },
    });
    expect(result).toEqual({ error: null });
  });

  it('returns the auth error instead of throwing', async () => {
    const error = apiError(
      'For security purposes, you can only request this after 42 seconds.',
      429,
      'over_email_send_rate_limit',
    );
    resend.mockResolvedValue({ data: {}, error });

    await expect(sendSignupCode('rider@example.com')).resolves.toEqual({ error });
  });
});

describe('verifySignupCode', () => {
  it('verifies the code as an email OTP for the normalized email', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: {} }, error: null });

    const result = await verifySignupCode(' Rider@Example.com', '482913');

    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'rider@example.com',
      token: '482913',
      type: 'email',
    });
    expect(result).toEqual({ error: null });
  });
});

describe('classifyAuthError', () => {
  it('reads email_not_confirmed from the code even though Supabase sends it as a 400', () => {
    expect(classifyAuthError(apiError('Email not confirmed', 400, 'email_not_confirmed'))).toEqual({
      kind: EMAIL_AUTH_ERROR.NOT_CONFIRMED,
    });
  });

  it('falls back to the message when the error carries no code', () => {
    expect(classifyAuthError(apiError('Email not confirmed', 400))).toEqual({
      kind: EMAIL_AUTH_ERROR.NOT_CONFIRMED,
    });
  });

  it('treats otp_expired as one invalid-or-expired case', () => {
    expect(
      classifyAuthError(apiError('Token has expired or is invalid', 403, 'otp_expired')),
    ).toEqual({ kind: EMAIL_AUTH_ERROR.INVALID_OR_EXPIRED });
  });

  it('reports the server wait for an email-send rate limit', () => {
    const error = apiError(
      'For security purposes, you can only request this after 42 seconds.',
      429,
      'over_email_send_rate_limit',
    );
    expect(classifyAuthError(error)).toEqual({
      kind: EMAIL_AUTH_ERROR.RATE_LIMITED,
      retryAfterMs: 42_000,
    });
  });

  it('defaults the rate-limit wait to the full cooldown when the message has no number', () => {
    const error = apiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit');
    expect(classifyAuthError(error)).toEqual({
      kind: EMAIL_AUTH_ERROR.RATE_LIMITED,
      retryAfterMs: RESEND_COOLDOWN_MS,
    });
  });

  it('separates too many verify attempts from a wrong code', () => {
    expect(
      classifyAuthError(apiError('Request rate limit reached', 429, 'over_request_rate_limit')),
    ).toEqual({ kind: EMAIL_AUTH_ERROR.THROTTLED });
  });

  it('classifies a dropped connection as a network failure', () => {
    expect(classifyAuthError(new AuthRetryableFetchError('Failed to fetch', 0))).toEqual({
      kind: EMAIL_AUTH_ERROR.NETWORK,
    });
    expect(classifyAuthError(new TypeError('Network request failed'))).toEqual({
      kind: EMAIL_AUTH_ERROR.NETWORK,
    });
  });

  it('leaves unknown errors generic', () => {
    expect(classifyAuthError(apiError('Database error saving new user', 500))).toEqual({
      kind: EMAIL_AUTH_ERROR.GENERIC,
    });
  });
});
