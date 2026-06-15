import { describe, expect, it, vi } from 'vitest';

// canonical.ts -> constants -> next-intl navigation can't resolve under node.
vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

const BASE_URL = 'https://motovault.app';
const { tripDetailEntries, exploreDiscoveryEntries } = await import('../sitemap-trips');
type PublishedTrip = import('../sitemap-trips').PublishedTrip;

const t = (
  countryCode: string,
  regionCode: string,
  slug: string,
  updatedAt: string,
): PublishedTrip => ({ countryCode, regionCode, slug, updatedAt }) as PublishedTrip;

const NOW = new Date('2026-06-15T00:00:00.000Z');

describe('tripDetailEntries', () => {
  it('lowercases the URL to match the canonical and parses updatedAt', () => {
    const [entry] = tripDetailEntries(
      [t('ZA', 'ZA-WC', 'Cape-Ride', '2026-06-01T00:00:00.000Z')],
      NOW,
    );
    expect(entry.url).toBe(`${BASE_URL}/trips/za/za-wc/cape-ride`);
    expect(entry.lastModified).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });

  it('falls back to `now` when updatedAt is empty', () => {
    const [entry] = tripDetailEntries([t('us', 'ca', 'x', '')], NOW);
    expect(entry.lastModified).toBe(NOW);
  });

  it('maps every trip', () => {
    expect(tripDetailEntries([t('us', 'ca', 'a', 'x'), t('us', 'ny', 'b', 'x')], NOW)).toHaveLength(
      2,
    );
  });
});

describe('exploreDiscoveryEntries', () => {
  it('dedupes countries and regions and lowercases them', () => {
    const urls = exploreDiscoveryEntries(
      [t('US', 'CA', 'a', 'x'), t('US', 'CA', 'b', 'x'), t('US', 'NY', 'c', 'x')],
      NOW,
    ).map((e) => e.url);

    expect(urls).toContain(`${BASE_URL}/explore/us`);
    expect(urls).toContain(`${BASE_URL}/explore/us/ca`);
    expect(urls).toContain(`${BASE_URL}/explore/us/ny`);
    // 1 unique country + 2 unique regions
    expect(urls).toHaveLength(3);
  });

  it('returns nothing for no trips', () => {
    expect(exploreDiscoveryEntries([], NOW)).toEqual([]);
  });
});
