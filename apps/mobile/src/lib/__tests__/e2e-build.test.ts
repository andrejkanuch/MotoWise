import { vendorSdksDisabled } from '../e2e-build';

describe('vendorSdksDisabled', () => {
  it('is on only for the exact value the E2E profiles set', () => {
    expect(vendorSdksDisabled('1')).toBe(true);
  });

  it('is off when unset or anything else, as in store builds', () => {
    expect(vendorSdksDisabled(undefined)).toBe(false);
    expect(vendorSdksDisabled('')).toBe(false);
    expect(vendorSdksDisabled('0')).toBe(false);
    expect(vendorSdksDisabled('true')).toBe(false);
  });
});
