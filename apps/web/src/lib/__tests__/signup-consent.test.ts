import { describe, expect, it } from 'vitest';
import { SIGNUP_CONSENT_METADATA_KEY, signUpConsentOptions } from '../signup-consent';

describe('signUpConsentOptions', () => {
  it('keeps the metadata key the server reads (00184)', () => {
    expect(SIGNUP_CONSENT_METADATA_KEY).toBe('analytics_consent');
  });

  it('carries an accepted or declined cookie-banner decision', () => {
    expect(signUpConsentOptions(true)).toEqual({ data: { analytics_consent: true } });
    expect(signUpConsentOptions(false)).toEqual({ data: { analytics_consent: false } });
  });

  it('sends nothing when the visitor has not decided', () => {
    expect(signUpConsentOptions(null)).toBeUndefined();
  });
});
