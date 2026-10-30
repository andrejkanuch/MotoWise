import { describe, expect, it } from 'vitest';
import { curatorName, humanRegionName } from '../display-names';

describe('humanRegionName', () => {
  it('returns the mapped name', () => {
    expect(humanRegionName('US', 'CA')).toBe('California');
  });

  it('retries an ISO code without its country prefix', () => {
    expect(humanRegionName('US', 'US-CA')).toBe('California');
  });

  it('returns null instead of a title-cased code', () => {
    expect(humanRegionName('CL', 'CL-NB')).toBeNull();
    expect(humanRegionName('CL', 'cl-nb')).toBeNull();
  });

  it('returns null without a region', () => {
    expect(humanRegionName('US', null)).toBeNull();
  });
});

describe('curatorName', () => {
  it('keeps a real display name', () => {
    expect(curatorName('Andrej')).toBe('Andrej');
  });

  it('drops the API placeholder and empty names', () => {
    expect(curatorName('Rider')).toBeNull();
    expect(curatorName('')).toBeNull();
    expect(curatorName(null)).toBeNull();
  });
});
