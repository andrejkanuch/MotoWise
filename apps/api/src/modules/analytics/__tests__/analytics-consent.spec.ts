import { describe, expect, it } from 'vitest';
import { hasAnalyticsConsent, readAnalyticsDecision } from '../analytics-consent';

describe('hasAnalyticsConsent', () => {
  it('only a saved "no" withholds consent; NULL still counts as consent', () => {
    expect(hasAnalyticsConsent(true)).toBe(true);
    expect(hasAnalyticsConsent(null)).toBe(true);
    expect(hasAnalyticsConsent(false)).toBe(false);
  });
});

describe('readAnalyticsDecision (same order as 00184)', () => {
  it('prefers the account decision over the one sent at sign-up', () => {
    expect(
      readAnalyticsDecision({ privacy: { analyticsEnabled: true } }, { analytics_consent: false }),
    ).toBe(true);
  });

  it('falls back to the sign-up decision', () => {
    expect(readAnalyticsDecision({ privacy: {} }, { analytics_consent: false })).toBe(false);
  });

  it('accepts only real booleans', () => {
    expect(
      readAnalyticsDecision({ privacy: { analyticsEnabled: 'false' } }, { analytics_consent: 0 }),
    ).toBeNull();
  });

  it('returns null when neither exists', () => {
    expect(readAnalyticsDecision(null, undefined)).toBeNull();
  });
});
