import { describe, expect, it } from 'vitest';
import {
  isNewWebOAuthAccount,
  SIGNUP_PLATFORM_METADATA_KEY,
  webSignUpOptions,
} from '../signup-platform';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const oauthUser = (over: Record<string, unknown> = {}) => ({
  created_at: '2026-10-06T11:59:30.000Z',
  app_metadata: { provider: 'google' },
  user_metadata: {},
  ...over,
});

describe('webSignUpOptions', () => {
  it('keeps the metadata key the server reads (00188)', () => {
    expect(SIGNUP_PLATFORM_METADATA_KEY).toBe('signup_platform');
  });

  it('always tags the account as a web sign-up', () => {
    expect(webSignUpOptions(null)).toEqual({ data: { signup_platform: 'web' } });
  });

  it('still carries the cookie-banner decision', () => {
    expect(webSignUpOptions(false)).toEqual({
      data: { analytics_consent: false, signup_platform: 'web' },
    });
  });
});

describe('isNewWebOAuthAccount', () => {
  it('is true for a Google or Apple account created moments ago', () => {
    expect(isNewWebOAuthAccount(oauthUser(), NOW)).toBe(true);
    expect(isNewWebOAuthAccount(oauthUser({ app_metadata: { provider: 'apple' } }), NOW)).toBe(
      true,
    );
  });

  it('is false for a returning account', () => {
    expect(isNewWebOAuthAccount(oauthUser({ created_at: '2026-09-01T10:00:00.000Z' }), NOW)).toBe(
      false,
    );
  });

  it('is false for an email account (an app sign-up can confirm through the callback)', () => {
    expect(isNewWebOAuthAccount(oauthUser({ app_metadata: { provider: 'email' } }), NOW)).toBe(
      false,
    );
    expect(isNewWebOAuthAccount(oauthUser({ app_metadata: {} }), NOW)).toBe(false);
  });

  it('never overwrites an existing tag', () => {
    expect(
      isNewWebOAuthAccount(oauthUser({ user_metadata: { signup_platform: 'web' } }), NOW),
    ).toBe(false);
  });

  it('is false when the creation time is missing or invalid', () => {
    expect(isNewWebOAuthAccount(oauthUser({ created_at: undefined }), NOW)).toBe(false);
    expect(isNewWebOAuthAccount(oauthUser({ created_at: 'nope' }), NOW)).toBe(false);
  });
});
