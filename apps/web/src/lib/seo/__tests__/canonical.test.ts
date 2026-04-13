import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({
  BASE_URL: 'https://motovault.app',
}));

import { canonicalRoute, canonicalRegion, canonicalCountry } from '../canonical';

describe('canonical URL builders', () => {
  it('canonicalRoute builds /route/{country}/{region}/{slug}', () => {
    expect(canonicalRoute('us', 'ca', 'pacific-coast')).toBe(
      'https://motovault.app/route/us/ca/pacific-coast',
    );
  });

  it('canonicalRegion builds /explore/{country}/{region}', () => {
    expect(canonicalRegion('us', 'ca')).toBe(
      'https://motovault.app/explore/us/ca',
    );
  });

  it('canonicalCountry builds /explore/{country}', () => {
    expect(canonicalCountry('us')).toBe(
      'https://motovault.app/explore/us',
    );
  });
});
