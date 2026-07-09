import { describe, expect, it } from 'vitest';
import { findBareSlugRedirect, findLegacySlugAlias, type TripSlugRef } from '../bare-slug-redirect';

const ref = (slug: string | null, regionCode: string | null, countryCode = 'US'): TripSlugRef => ({
  slug,
  regionCode,
  countryCode,
});

const TRIPS: TripSlugRef[] = [
  ref('zionmount-carmel-highway-a90b4890', 'ut'),
  ref('scenic-byway-12-f01cfd20', 'ut'),
  ref('dalton-highway-fairbanks-to-the-arctic-ocean', 'ak'),
  ref('great-ocean-road-1a2b3c4d', 'au-vic', 'AU'),
];

describe('findBareSlugRedirect', () => {
  it('redirects a bare slug to its canonical hashed slug', () => {
    expect(findBareSlugRedirect(TRIPS, 'us', 'ut', 'zionmount-carmel-highway')).toBe(
      'zionmount-carmel-highway-a90b4890',
    );
  });

  it('is case-insensitive on country, region, and the requested slug', () => {
    expect(findBareSlugRedirect(TRIPS, 'US', 'UT', 'ZionMount-Carmel-Highway')).toBe(
      'zionmount-carmel-highway-a90b4890',
    );
  });

  it('matches mixed-case region codes stored on the trip (AU-VIC)', () => {
    expect(findBareSlugRedirect(TRIPS, 'au', 'au-vic', 'great-ocean-road')).toBe(
      'great-ocean-road-1a2b3c4d',
    );
  });

  it('returns null when the slug already resolves cleanly (no hash suffix)', () => {
    // dalton has no hash — caller would have found it via exact lookup already.
    expect(
      findBareSlugRedirect(TRIPS, 'us', 'ak', 'dalton-highway-fairbanks-to-the-arctic-ocean'),
    ).toBeNull();
  });

  it('only matches an 8-hex dedup hash, not an arbitrary longer slug', () => {
    const trips = [ref('scenic-byway-12-extended-loop', 'ut')];
    // "extended" is not an 8-hex hash → genuinely different route → no redirect.
    expect(findBareSlugRedirect(trips, 'us', 'ut', 'scenic-byway-12')).toBeNull();
  });

  it('does not redirect when the bare slug is ambiguous (multiple hash matches)', () => {
    const trips = [ref('canyon-loop-11111111', 'ut'), ref('canyon-loop-22222222', 'ut')];
    expect(findBareSlugRedirect(trips, 'us', 'ut', 'canyon-loop')).toBeNull();
  });

  it('requires the region to match — a hash match in another region is ignored', () => {
    expect(findBareSlugRedirect(TRIPS, 'us', 'az', 'zionmount-carmel-highway')).toBeNull();
  });

  it('requires the country to match', () => {
    expect(findBareSlugRedirect(TRIPS, 'ca', 'ut', 'zionmount-carmel-highway')).toBeNull();
  });

  it('ignores rows with null slug or region', () => {
    const trips = [ref(null, 'ut'), ref('x-12345678', null)];
    expect(findBareSlugRedirect(trips, 'us', 'ut', 'x')).toBeNull();
  });

  it('returns null for an empty trip list', () => {
    expect(findBareSlugRedirect([], 'us', 'ut', 'anything')).toBeNull();
  });

  it('does not treat the exact hashed slug as a self-prefix match', () => {
    // Requesting the full canonical slug: "slug-" prefix would need a *further*
    // hash segment, which doesn't exist → null (caller already served it).
    expect(findBareSlugRedirect(TRIPS, 'us', 'ut', 'zionmount-carmel-highway-a90b4890')).toBeNull();
  });
});

describe('findLegacySlugAlias', () => {
  it('resolves a known legacy /route/-era slug to its renamed canonical slug', () => {
    expect(findLegacySlugAlias('us', 'ca', 'pacific-coast-highway')).toBe(
      'pacific-coast-highway-big-sur',
    );
  });

  it('is case-insensitive on all three URL segments', () => {
    expect(findLegacySlugAlias('US', 'CA', 'Pacific-Coast-Highway')).toBe(
      'pacific-coast-highway-big-sur',
    );
  });

  it('returns null for slugs without a legacy alias', () => {
    expect(findLegacySlugAlias('us', 'ca', 'some-other-route')).toBeNull();
  });

  it('requires country and region to match, not just the slug', () => {
    expect(findLegacySlugAlias('us', 'or', 'pacific-coast-highway')).toBeNull();
    expect(findLegacySlugAlias('ca', 'ca', 'pacific-coast-highway')).toBeNull();
  });

  it('never maps a slug to itself (redirect-loop insurance for future map entries)', () => {
    // Probe every known alias through the public API: the resolved target must
    // differ from the requested slug, or the page would 308 into itself.
    const knownAliases = [['us', 'ca', 'pacific-coast-highway']] as const;
    for (const [country, region, slug] of knownAliases) {
      expect(findLegacySlugAlias(country, region, slug)).not.toBe(slug);
    }
  });
});
