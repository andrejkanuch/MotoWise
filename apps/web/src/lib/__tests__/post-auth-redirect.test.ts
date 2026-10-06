import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POST_AUTH_PATH,
  FIRST_SESSION_WINDOW_MS,
  isFirstSession,
  postAuthDestination,
  signUpEmailRedirectTo,
  WELCOME_PATH,
} from '@/lib/post-auth-redirect';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** A brand-new OAuth account / instant sign-up: created and confirmed seconds ago. */
const newOAuthUser = { created_at: iso(-5_000), email_confirmed_at: iso(-5_000) };
/** Signed up yesterday, clicked the confirmation link just now. */
const justConfirmedUser = { created_at: iso(-DAY), email_confirmed_at: iso(-30_000) };
/** A returning rider: account and confirmation both long ago. */
const returningUser = { created_at: iso(-30 * DAY), email_confirmed_at: iso(-30 * DAY) };
/** Signed up, never confirmed (only possible with confirmations off). */
const unconfirmedOldUser = { created_at: iso(-30 * DAY), email_confirmed_at: null };

describe('isFirstSession', () => {
  it('is true for an account created moments ago (first Google / Apple login)', () => {
    expect(isFirstSession(newOAuthUser, NOW)).toBe(true);
  });

  it('is true right after the email confirmation, even for an older sign-up', () => {
    expect(isFirstSession(justConfirmedUser, NOW)).toBe(true);
  });

  it('is false for a returning rider', () => {
    expect(isFirstSession(returningUser, NOW)).toBe(false);
    expect(isFirstSession(unconfirmedOldUser, NOW)).toBe(false);
  });

  it('respects the window edges', () => {
    const atEdge = { created_at: iso(-FIRST_SESSION_WINDOW_MS) };
    const pastEdge = { created_at: iso(-FIRST_SESSION_WINDOW_MS - 1) };
    expect(isFirstSession(atEdge, NOW)).toBe(true);
    expect(isFirstSession(pastEdge, NOW)).toBe(false);
  });

  it('tolerates small clock skew (timestamp slightly in the future)', () => {
    expect(isFirstSession({ created_at: iso(30_000) }, NOW)).toBe(true);
  });

  it('reads a missing user or unparseable timestamps as returning', () => {
    expect(isFirstSession(null, NOW)).toBe(false);
    expect(isFirstSession(undefined, NOW)).toBe(false);
    expect(isFirstSession({}, NOW)).toBe(false);
    expect(isFirstSession({ created_at: 'not a date', email_confirmed_at: '' }, NOW)).toBe(false);
  });
});

describe('postAuthDestination', () => {
  it('sends a first session with no redirect to the welcome screen', () => {
    expect(postAuthDestination({ redirect: null, user: newOAuthUser, now: NOW })).toBe(
      WELCOME_PATH,
    );
    expect(postAuthDestination({ redirect: undefined, user: justConfirmedUser, now: NOW })).toBe(
      WELCOME_PATH,
    );
  });

  it('treats the default /garage redirect (what the auth pages send) as "no intent"', () => {
    expect(postAuthDestination({ redirect: '/garage', user: newOAuthUser, now: NOW })).toBe(
      WELCOME_PATH,
    );
  });

  it('sends a returning rider to /garage, as before', () => {
    expect(postAuthDestination({ redirect: null, user: returningUser, now: NOW })).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
    expect(postAuthDestination({ redirect: '/garage', user: returningUser, now: NOW })).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
    expect(postAuthDestination({ redirect: null, user: null, now: NOW })).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
  });

  it('keeps an explicit redirect for a first session (checkout, password reset, modal page)', () => {
    for (const redirect of ['/pro/checkout', '/pro/checkout?plan=annual', '/reset-password']) {
      expect(postAuthDestination({ redirect, user: newOAuthUser, now: NOW })).toBe(redirect);
    }
    expect(postAuthDestination({ redirect: '/ride/abc', user: justConfirmedUser, now: NOW })).toBe(
      '/ride/abc',
    );
  });

  it('keeps an explicit redirect for a returning rider', () => {
    expect(postAuthDestination({ redirect: '/pro/checkout', user: returningUser, now: NOW })).toBe(
      '/pro/checkout',
    );
  });

  it('never follows an off-site redirect; falls back by first-session as usual', () => {
    for (const redirect of ['https://evil.com', '//evil.com', '/\\evil.com', 'garage']) {
      expect(postAuthDestination({ redirect, user: returningUser, now: NOW })).toBe(
        DEFAULT_POST_AUTH_PATH,
      );
      expect(postAuthDestination({ redirect, user: newOAuthUser, now: NOW })).toBe(WELCOME_PATH);
    }
  });
});

describe('signUpEmailRedirectTo', () => {
  it('routes the confirmation link through /auth/callback with the default redirect', () => {
    expect(signUpEmailRedirectTo('https://motovault.app', null)).toBe(
      'https://motovault.app/auth/callback?redirect=%2Fgarage',
    );
  });

  it('carries a safe ?redirect= through, encoded', () => {
    expect(signUpEmailRedirectTo('http://localhost:3000', '/pro/checkout?plan=annual')).toBe(
      'http://localhost:3000/auth/callback?redirect=%2Fpro%2Fcheckout%3Fplan%3Dannual',
    );
  });

  it('drops an unsafe redirect', () => {
    expect(signUpEmailRedirectTo('https://motovault.app', '//evil.com')).toBe(
      'https://motovault.app/auth/callback?redirect=%2Fgarage',
    );
  });
});
