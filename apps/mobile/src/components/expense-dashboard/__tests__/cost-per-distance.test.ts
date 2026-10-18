import { describe, expect, it } from '@jest/globals';
import { costPerDistance } from '../cost-per-distance';

describe('costPerDistance', () => {
  it('uses the bike odometer when no route param is passed', () => {
    expect(costPerDistance(1200, 8000, undefined)).toBe(0.15);
  });

  it('prefers the bike odometer over a stale route param', () => {
    expect(costPerDistance(1200, 8000, '6000')).toBe(0.15);
  });

  it('falls back to the route param while the bike list loads', () => {
    expect(costPerDistance(1200, undefined, '6000')).toBe(0.2);
  });

  it('is null without a positive odometer', () => {
    expect(costPerDistance(1200, null, undefined)).toBeNull();
    expect(costPerDistance(1200, 0, undefined)).toBeNull();
    expect(costPerDistance(1200, undefined, '')).toBeNull();
    expect(costPerDistance(1200, undefined, 'abc')).toBeNull();
  });
});
