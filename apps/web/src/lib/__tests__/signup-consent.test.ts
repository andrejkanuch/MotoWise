import { describe, expect, it } from 'vitest';
import {
  consentMetadataUpdate,
  SIGNUP_CONSENT_METADATA_KEY,
  signUpConsentOptions,
} from '../signup-consent';

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

describe('consentMetadataUpdate', () => {
  it('writes the banner decision when the account differs or has none', () => {
    expect(consentMetadataUpdate(false, { analytics_consent: true })).toEqual({
      analytics_consent: false,
    });
    expect(consentMetadataUpdate(true, {})).toEqual({ analytics_consent: true });
    expect(consentMetadataUpdate(true, undefined)).toEqual({ analytics_consent: true });
  });

  it('writes nothing when equal or undecided (never null)', () => {
    expect(consentMetadataUpdate(true, { analytics_consent: true })).toBeNull();
    expect(consentMetadataUpdate(null, { analytics_consent: true })).toBeNull();
  });
});
