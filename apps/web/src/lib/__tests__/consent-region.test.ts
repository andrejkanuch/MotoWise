import { describe, expect, it } from 'vitest';
import { CONSENT_REQUIRED_COUNTRIES, regionCookieUpdate } from '../consent-region';

describe('regionCookieUpdate (proxy mv_region)', () => {
  it('sets the cookie on first visit, as before', () => {
    expect(regionCookieUpdate(undefined, 'DE')).toBe('EU');
    expect(regionCookieUpdate(undefined, 'US')).toBe('OTHER');
    expect(regionCookieUpdate(undefined, null)).toBe('OTHER');
  });

  it('rewrites a stale OTHER for a newly added opt-in region', () => {
    expect(regionCookieUpdate('OTHER', 'RE')).toBe('EU');
  });

  it('rewrites EU when the visitor is now outside the opt-in list', () => {
    expect(regionCookieUpdate('EU', 'US')).toBe('OTHER');
  });

  it('leaves a matching cookie alone', () => {
    expect(regionCookieUpdate('EU', 'FR')).toBeNull();
    expect(regionCookieUpdate('OTHER', 'BR')).toBeNull();
  });

  it('leaves the cookie alone when there is no geo header', () => {
    expect(regionCookieUpdate('OTHER', null)).toBeNull();
    expect(regionCookieUpdate('EU', '')).toBeNull();
  });

  it('keeps the 39-code list (EEA 30 + 7 outermost regions + GB + CH), without GI', () => {
    expect(CONSENT_REQUIRED_COUNTRIES.size).toBe(39);
    expect(CONSENT_REQUIRED_COUNTRIES.has('GI')).toBe(false);
  });
});
