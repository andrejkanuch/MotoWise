import { describe, expect, it } from '@jest/globals';
import { breakdownOverTotal } from '../receipt-breakdown';

describe('breakdownOverTotal', () => {
  it('returns the sum when parts + labor + tax are over the total, even by 5 cents', () => {
    expect(breakdownOverTotal({ total: 105, parts: 60, labor: 40, tax: 5.05 })).toBe(105.05);
  });

  it('is null when the breakdown matches or is under the total', () => {
    expect(breakdownOverTotal({ total: 105.05, parts: 60, labor: 40, tax: 5.05 })).toBeNull();
    expect(breakdownOverTotal({ total: 120, parts: 60, labor: null, tax: null })).toBeNull();
  });

  it('ignores floating-point noise below the server slack', () => {
    expect(breakdownOverTotal({ total: 0.3, parts: 0.1, labor: 0.2, tax: null })).toBeNull();
  });

  it('is null when there is no positive total to compare against', () => {
    expect(breakdownOverTotal({ total: null, parts: 10, labor: 5, tax: 1 })).toBeNull();
    expect(breakdownOverTotal({ total: 0, parts: 10, labor: 5, tax: 1 })).toBeNull();
  });
});
