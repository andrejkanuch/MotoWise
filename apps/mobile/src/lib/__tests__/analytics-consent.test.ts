import {
  ANALYTICS_CONSENT_KEY,
  accountConsentDecision,
  buildPrivacyUpdate,
  CONSENT_STATE,
  deviceConsentDecision,
  reconcileConsent,
  requiresOptIn,
  resolveLaunchConsent,
  signUpConsentMetadata,
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
    stored('granted:v2:1700000000000');
    expect(resolveLaunchConsent('DE')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('honours a stored "no" even where the default is opt-out', () => {
    stored('denied:v2:1700000000000');
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.DENIED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('grants AND persists the automatic grant for a fresh install outside opt-in regions', () => {
    stored(null);
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY, 'granted-default:v2');
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

  it('upgrades a legacy "yes" to the automatic grant outside opt-in regions', () => {
    stored('true');
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY, 'granted-default:v2');
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
    expect(accountConsentDecision({ analyticsEnabled: false }, 'DE')).toEqual({
      enabled: false,
      decidedAt: 0,
    });
  });

  it('applies a versioned "yes" anywhere', () => {
    expect(
      accountConsentDecision({ analyticsEnabled: true, consentVersion: 2, decidedAt: 5 }, 'DE'),
    ).toEqual({ enabled: true, decidedAt: 5 });
  });

  it('ignores an unversioned "yes" (the old default) in an opt-in region', () => {
    expect(accountConsentDecision({ analyticsEnabled: true }, 'DE')).toBeNull();
  });

  it('applies an unversioned "yes" outside opt-in regions', () => {
    expect(accountConsentDecision({ analyticsEnabled: true }, 'US')).toEqual({
      enabled: true,
      decidedAt: 0,
    });
  });
});

describe('deviceConsentDecision (only explicit choices)', () => {
  it('returns a timestamped explicit decision', () => {
    stored('denied:v2:42');
    expect(deviceConsentDecision()).toEqual({ enabled: false, decidedAt: 42 });
  });

  it('returns nothing for the automatic grant — it is not a choice, so never uploaded', () => {
    stored('granted-default:v2');
    expect(deviceConsentDecision()).toBeNull();
  });

  it('returns nothing when undecided or the keychain is locked', () => {
    stored(null);
    expect(deviceConsentDecision()).toBeNull();
    stored('granted:v2:1', SECURE_STORE_STATUS.LOCKED);
    expect(deviceConsentDecision()).toBeNull();
  });
});

describe('reconcileConsent (the newer decision wins)', () => {
  const yes = (decidedAt: number) => ({ enabled: true, decidedAt });
  const no = (decidedAt: number) => ({ enabled: false, decidedAt });

  it('uploads a device decision the account lacks', () => {
    expect(reconcileConsent(no(10), null)).toEqual({ apply: null, upload: no(10) });
  });

  it('takes over an account decision the device lacks', () => {
    expect(reconcileConsent(null, yes(10))).toEqual({ apply: yes(10), upload: null });
  });

  it('does nothing when they agree', () => {
    expect(reconcileConsent(yes(10), yes(3))).toEqual({ apply: null, upload: null });
  });

  // A rider who declines on a new phone, then signs in to an account that said
  // yes months ago: the decline is newer, so it wins and is saved to the account.
  it('keeps a newer device "no" over an older account "yes"', () => {
    expect(reconcileConsent(no(20), yes(10))).toEqual({ apply: null, upload: no(20) });
  });

  it('takes a newer account decision over an older device one', () => {
    expect(reconcileConsent(yes(10), no(20))).toEqual({ apply: no(20), upload: null });
  });

  it('lets "no" win a tie', () => {
    expect(reconcileConsent(yes(10), no(10))).toEqual({ apply: no(10), upload: null });
    expect(reconcileConsent(no(10), yes(10))).toEqual({ apply: null, upload: no(10) });
  });
});

describe('buildPrivacyUpdate', () => {
  it('saves an analytics decision versioned and timestamped, keeping other keys', () => {
    expect(
      buildPrivacyUpdate(
        { crashReportingEnabled: false },
        { analytics: { enabled: true, decidedAt: 7 } },
      ),
    ).toEqual({
      crashReportingEnabled: false,
      analyticsEnabled: true,
      decidedAt: 7,
      consentVersion: 2,
    });
  });

  // The Privacy screen's crash toggle must not turn the legacy default "yes"
  // into a trusted, versioned decision as a side effect.
  it('leaves an unversioned legacy "yes" unversioned on a crash-only change', () => {
    expect(
      buildPrivacyUpdate({ analyticsEnabled: true }, { crashReportingEnabled: false }),
    ).toEqual({
      analyticsEnabled: true,
      crashReportingEnabled: false,
    });
  });
});

describe('signUpConsentMetadata', () => {
  it('carries an explicit decision', () => {
    stored('denied:v2:1');
    expect(signUpConsentMetadata()).toEqual({ analytics_consent: false });
  });

  it('carries nothing without an explicit decision', () => {
    stored('granted-default:v2');
    expect(signUpConsentMetadata()).toEqual({});
  });
});
