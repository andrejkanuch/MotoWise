import { isE2eRun, vendorSdksDisabled } from '../e2e-build';

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

describe('isE2eRun', () => {
  it('is on only for the exact value the E2E profiles set', () => {
    expect(isE2eRun('1')).toBe(true);
  });

  it('is off when unset or anything else, as in store builds', () => {
    expect(isE2eRun(undefined)).toBe(false);
    expect(isE2eRun('')).toBe(false);
    expect(isE2eRun('0')).toBe(false);
    expect(isE2eRun('true')).toBe(false);
  });
});
