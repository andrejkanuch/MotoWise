import {
  ANALYTICS_CONSENT_KEY,
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
  it('honours a stored "yes" in any region', () => {
    stored('true');
    expect(resolveLaunchConsent('DE')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('honours a stored "no" even where the default is opt-out', () => {
    stored('false');
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.DENIED);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('grants AND persists consent for a fresh install outside the opt-in regions', () => {
    stored(null);
    expect(resolveLaunchConsent('US')).toBe(CONSENT_STATE.GRANTED);
    expect(mockWrite).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY, 'true');
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
});
