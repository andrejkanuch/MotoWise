import {
  ANALYTICS_CONSENT_KEY,
  accountConsentDecision,
  CONSENT_STATE,
  requiresOptIn,
  resolveLaunchConsent,
} from '../analytics-consent';
import { SECURE_STORE_STATUS } from '../secure-store';

const mockRead = jest.fn();
const mockWrite = jest.fn();

jest.mock('../secure-store', () => ({
  SECURE_STORE_KEY: { ANALYTICS_CONSENT: 'motovault.analytics-consent' },
  SECURE_STORE_STATUS: { OK: 'ok', LOCKED: 'locked', FAILED: 'failed' },
  readSecureItemSync: (...a: unknown[]) => mockRead(...a),
  getSecureItemSync: jest.fn(() => null),
  setSecureItemSync: (...a: unknown[]) => mockWrite(...a),
}));

jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'US' }] }));

function stored(value: string | null, status: string = SECURE_STORE_STATUS.OK) {
  mockRead.mockReturnValue({ status, value });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requiresOptIn', () => {
  it.each(['DE', 'SK', 'FR', 'NO', 'GB', 'CH', 'de'])('%s needs opt-in', (region) => {
    expect(requiresOptIn(region)).toBe(true);
  });

  it.each(['US', 'BR', 'CA', 'MX', 'JP'])('%s is opt-out', (region) => {
    expect(requiresOptIn(region)).toBe(false);
  });

  it('treats an unknown region as opt-in', () => {
    expect(requiresOptIn(null)).toBe(true);
    expect(requiresOptIn('')).toBe(true);
  });
});

describe('resolveLaunchConsent', () => {
  it('honours a stored versioned "yes" in any region', () => {
    stored('granted:v2');
    expect(resolveLaunchConsent('DE')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('honours a stored "no" even where the default is opt-out', () => {
    stored('denied:v2');
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.DENIED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('grants AND persists consent for a fresh install outside the opt-in regions', () => {
    stored(null);
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY, 'granted:v2');
  });

  it('leaves a fresh install in an opt-in region undecided, writing nothing', () => {
    stored(null);
    expect(resolveLaunchConsent('SK')).toBe(CONSENT_STATE.UNDECIDED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('never writes when the keychain is locked — a stored "no" must survive', () => {
    stored(null, SECURE_STORE_STATUS.LOCKED);
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.UNKNOWN);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  // Before 3.21.0 the Privacy screen saved its default "yes" just by being
  // opened, so a legacy "yes" is not a choice where opt-in is required.
  it('re-asks a legacy "yes" in an opt-in region, writing nothing', () => {
    stored('true');
    expect(resolveLaunchConsent('DE')).toBe(CONSENT_STATE.UNDECIDED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('upgrades a legacy "yes" to a versioned grant outside opt-in regions', () => {
    stored('true');
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY, 'granted:v2');
  });

  it('always honours a legacy "no"', () => {
    stored('false');
    expect(resolveLaunchConsent('DE')).toBe(CONSENT_STATE.DENIED);
  });
});

describe('accountConsentDecision', () => {
  it('has no decision when the account saved none', () => {
    expect(accountConsentDecision(undefined, 'DE')).toBeNull();
    expect(accountConsentDecision({}, 'US')).toBeNull();
  });

  it('always applies a saved "no"', () => {
    expect(accountConsentDecision({ analyticsEnabled: false }, 'DE')).toBe(false);
  });

  it('applies a versioned "yes" anywhere', () => {
    expect(accountConsentDecision({ analyticsEnabled: true, consentVersion: 2 }, 'DE')).toBe(true);
  });

  it('ignores an unversioned "yes" (the old default) in an opt-in region', () => {
    expect(accountConsentDecision({ analyticsEnabled: true }, 'DE')).toBeNull();
  });

  it('applies an unversioned "yes" outside opt-in regions', () => {
    expect(accountConsentDecision({ analyticsEnabled: true }, 'US')).toBe(true);
  });
});
