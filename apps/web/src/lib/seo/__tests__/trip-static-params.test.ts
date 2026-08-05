import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchRefs = vi.fn();
vi.mock('@/lib/fetch-places', () => ({
  fetchPublishedTripSlugRefs: () => mockFetchRefs(),
}));

import {
  countryParams,
  countryRegionParams,
  fetchTripRefsForStaticParams,
  MIN_EXPECTED_PUBLISHED_TRIPS,
  tripParams,
} from '../trip-static-params';

type Ref = { countryCode: string; regionCode: string | null; slug: string | null };

/** `n` distinct published trips, all in US/CA. */
const refs = (n: number): Ref[] =>
  Array.from({ length: n }, (_, i) => ({
    countryCode: 'US',
    regionCode: 'CA',
    slug: `trip-${i}`,
  }));

beforeEach(() => {
  mockFetchRefs.mockReset();
});

describe('fetchTripRefsForStaticParams — the build-failure floor', () => {
  it('throws on an empty list rather than 404ing every trip URL', async () => {
    // THE failure this guard exists for. The API's sitemapPublishedTrips catches its
    // own DB error and returns [] as a SUCCESSFUL response, so nothing rejects. With
    // dynamicParams=false an empty param list means every trip and explore URL 404s
    // on a green build — so the floor is the only thing that surfaces it.
    mockFetchRefs.mockResolvedValue([]);
    await expect(fetchTripRefsForStaticParams()).rejects.toThrow(/below the .* floor/);
  });

  it('throws on a short list (partially degraded upstream)', async () => {
    mockFetchRefs.mockResolvedValue(refs(MIN_EXPECTED_PUBLISHED_TRIPS - 1));
    await expect(fetchTripRefsForStaticParams()).rejects.toThrow(
      /published-trip list came back with/,
    );
  });

  it('names the actual count in the error so a failing build is diagnosable', async () => {
    mockFetchRefs.mockResolvedValue(refs(3));
    await expect(fetchTripRefsForStaticParams()).rejects.toThrow(/with 3 entries/);
  });

  it('passes the list through at exactly the floor', async () => {
    const list = refs(MIN_EXPECTED_PUBLISHED_TRIPS);
    mockFetchRefs.mockResolvedValue(list);
    await expect(fetchTripRefsForStaticParams()).resolves.toHaveLength(
      MIN_EXPECTED_PUBLISHED_TRIPS,
    );
  });

  it('propagates a genuine rejection unchanged', async () => {
    mockFetchRefs.mockRejectedValue(new Error('network down'));
    await expect(fetchTripRefsForStaticParams()).rejects.toThrow('network down');
  });
});

describe('param builders', () => {
  const mixed: Ref[] = [
    { countryCode: 'US', regionCode: 'CA', slug: 'a' },
    { countryCode: 'us', regionCode: 'ca', slug: 'A' }, // dupe once lowercased
    { countryCode: 'US', regionCode: 'MT', slug: 'b' },
    { countryCode: 'CA', regionCode: 'BC', slug: 'c' },
    { countryCode: 'FR', regionCode: null, slug: 'd' }, // no region
    { countryCode: 'IT', regionCode: 'TO', slug: null }, // no slug
  ];

  it('countryParams dedupes case-insensitively and lowercases', () => {
    expect(
      countryParams(mixed)
        .map((p) => p.country)
        .sort(),
    ).toEqual(['ca', 'fr', 'it', 'us']);
  });

  it('countryRegionParams skips refs with no region', () => {
    expect(countryRegionParams(mixed)).toEqual([
      { country: 'us', region: 'ca' },
      { country: 'us', region: 'mt' },
      { country: 'ca', region: 'bc' },
      { country: 'it', region: 'to' },
    ]);
  });

  it('tripParams needs both slug and region, and collapses case dupes to one URL', () => {
    // 'US/CA/a' and 'us/ca/A' are the same canonical URL — emitting both would make
    // Next.js prerender the same path twice.
    expect(tripParams(mixed)).toEqual([
      { country: 'us', region: 'ca', slug: 'a' },
      { country: 'us', region: 'mt', slug: 'b' },
      { country: 'ca', region: 'bc', slug: 'c' },
    ]);
  });
});
