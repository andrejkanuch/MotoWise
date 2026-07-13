import { isExpectedRevenueCatError } from '../revenuecat-errors';

/** Builds an RN Purchases-style rejection: an Error carrying code + userInfo. */
function rcError(code: string | number, readableErrorCode?: string): Error {
  const e = new Error('rc error') as Error & {
    code: string | number;
    userInfo?: { readableErrorCode?: string };
  };
  e.code = code;
  if (readableErrorCode) e.userInfo = { readableErrorCode };
  return e;
}

describe('isExpectedRevenueCatError', () => {
  it.each([
    ['1', 'purchase cancelled'],
    ['2', 'store problem'],
    ['3', 'purchase not allowed (MOTO-VAULT-REACT-NATIVE-7)'],
    ['10', 'network error (MOTO-VAULT-REACT-NATIVE-M)'],
    ['16', 'unknown backend error (MOTO-VAULT-REACT-NATIVE-1A)'],
    ['23', 'configuration error on user device (MOTO-VAULT-REACT-NATIVE-24)'],
    ['35', 'offline connection'],
  ])('treats code %s (%s) as expected', (code) => {
    expect(isExpectedRevenueCatError(rcError(code))).toBe(true);
  });

  it('normalizes numeric codes from older bridge paths', () => {
    expect(isExpectedRevenueCatError(rcError(3))).toBe(true);
  });

  it('falls back to userInfo.readableErrorCode when code is unrecognized', () => {
    const e = rcError('does-not-match', 'PurchaseNotAllowedError');
    expect(isExpectedRevenueCatError(e)).toBe(true);
  });

  it('does NOT swallow integration bugs', () => {
    // INVALID_CREDENTIALS (11) and INVALID_APP_USER_ID (14) are our mistakes.
    expect(isExpectedRevenueCatError(rcError('11'))).toBe(false);
    expect(isExpectedRevenueCatError(rcError('14'))).toBe(false);
    expect(isExpectedRevenueCatError(new Error('plain error'))).toBe(false);
    expect(isExpectedRevenueCatError(null)).toBe(false);
    expect(isExpectedRevenueCatError('string error')).toBe(false);
  });
});
