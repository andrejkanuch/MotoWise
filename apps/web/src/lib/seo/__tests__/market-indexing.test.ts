import { describe, expect, it } from 'vitest';
import { isTargetMarket } from '../market-indexing';

describe('isTargetMarket', () => {
  it('indexes Europe + the Americas', () => {
    for (const code of ['US', 'CA', 'MX', 'BR', 'AR', 'GB', 'DE', 'FR', 'ES', 'IT', 'PL']) {
      expect(isTargetMarket(code)).toBe(true);
    }
  });

  it('noindexes off-target geos (India, Asia, Oceania, Africa, ME)', () => {
    for (const code of ['IN', 'JP', 'TH', 'ID', 'AU', 'NZ', 'ZA', 'AE', 'CN']) {
      expect(isTargetMarket(code)).toBe(false);
    }
  });

  it('is case-insensitive and safe on missing codes', () => {
    expect(isTargetMarket('us')).toBe(true);
    expect(isTargetMarket('gb')).toBe(true);
    expect(isTargetMarket(null)).toBe(false);
    expect(isTargetMarket(undefined)).toBe(false);
    expect(isTargetMarket('')).toBe(false);
  });
});
