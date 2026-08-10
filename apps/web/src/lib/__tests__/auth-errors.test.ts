import { describe, expect, it } from 'vitest';
import {
  EMPTY_FIELDS_MESSAGE,
  hasCredentials,
  humanizeAuthError,
  recoveryForAttempt,
} from '@/lib/auth-errors';

describe('hasCredentials', () => {
  it('is false when either field is empty or whitespace', () => {
    expect(hasCredentials('', '')).toBe(false);
    expect(hasCredentials('  ', 'pw')).toBe(false);
    expect(hasCredentials('a@b.com', '')).toBe(false);
  });

  it('is true when both fields carry a value', () => {
    expect(hasCredentials('a@b.com', 'pw')).toBe(true);
  });
});

describe('humanizeAuthError', () => {
  it('maps the empty-field Supabase string to the guard message', () => {
    expect(humanizeAuthError({ message: 'Missing email or phone' }).message).toBe(
      EMPTY_FIELDS_MESSAGE,
    );
  });

  it('branches on the stable error code, not the message text', () => {
    const info = humanizeAuthError({
      code: 'invalid_credentials',
      message: 'reworded by supabase',
    });
    expect(info.message).toMatch(/Google or Apple/);
  });

  it('offers to resend confirmation when the email is not confirmed', () => {
    const info = humanizeAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' });
    expect(info.recovery).toBe('resend_confirmation');
    expect(info.message).toMatch(/resend/i);
  });

  it('nudges toward Google or Apple on invalid credentials', () => {
    const info = humanizeAuthError({ message: 'Invalid login credentials' });
    expect(info.message).toMatch(/Google or Apple/);
    expect(info.recovery).toBeNull();
  });

  it('passes unknown messages through unchanged', () => {
    expect(humanizeAuthError({ message: 'Rate limit exceeded' }).message).toBe(
      'Rate limit exceeded',
    );
  });
});

describe('recoveryForAttempt', () => {
  it('keeps the error-specific recovery regardless of attempt count', () => {
    const info = humanizeAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' });
    expect(recoveryForAttempt(info, 5)).toBe('resend_confirmation');
  });

  it('promotes password reset after two failures in a row', () => {
    const info = humanizeAuthError({ message: 'Invalid login credentials' });
    expect(recoveryForAttempt(info, 1)).toBeNull();
    expect(recoveryForAttempt(info, 2)).toBe('reset_password');
  });
});
