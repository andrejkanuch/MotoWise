import { afterEach, describe, expect, it, vi } from 'vitest';

// The /explore/[country] page is a server component that pulls in next-intl and
// next/navigation, so we exercise the data-fetch path it depends on rather than
// rendering it. We mock the GraphQL fetcher to throw (simulating a transient
// DB/API slowdown) and assert the error reaches the page: under the 30-day ISR
// window a thrown regeneration keeps the last good page, while an empty list
// would be cached for a month (lib/cache-windows.test.ts guards the page file).
vi.mock('@/lib/graphql-server', () => ({
  gqlServerFetcher: vi.fn(),
}));

// `unstable_cache` would otherwise wrap the helpers; pass through so the mocked
// fetcher is what actually runs.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import { fetchRegionsByCountrySlug, fetchRoutesByCountry } from '@/lib/fetch-places';
import { gqlServerFetcher } from '@/lib/graphql-server';

const mockedFetcher = vi.mocked(gqlServerFetcher);

/** Mirrors the resolution in CountryPage: the parallel fetch, uncaught. */
function resolveCountryData(countrySlug: string, countryCode: string) {
  return Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchRoutesByCountry(countryCode, 12),
  ]);
}

describe('explore/[country] parallel fetch error boundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lets an API error reach the page instead of an empty list', async () => {
    mockedFetcher.mockRejectedValue(new Error('Internal Server Error (500)'));

    await expect(resolveCountryData('us', 'US')).rejects.toThrow('Internal Server Error (500)');
  });

  it('returns fetched data on success', async () => {
    mockedFetcher.mockImplementation((async (document: unknown) => {
      const name = (document as { definitions?: Array<{ name?: { value?: string } }> })
        .definitions?.[0]?.name?.value;
      if (name === 'BrowseRegionsByCountrySlug') {
        return {
          browseRegionsByCountrySlug: [
            {
              id: 'r1',
              kind: 'region',
              name: 'California',
              countryCode: 'US',
              regionCode: 'CA',
              slug: 'california',
              parentId: 'c1',
              routeCount: 3,
            },
          ],
        };
      }
      return {
        tripTemplates: {
          edges: [{ node: { id: 't1', title: 'PCH', countryCode: 'US', slug: 'pch' } }],
        },
      };
    }) as typeof gqlServerFetcher);

    const [regions, topRoutes] = await resolveCountryData('us', 'US');

    expect(regions).toHaveLength(1);
    expect(regions[0]?.name).toBe('California');
    expect(topRoutes).toHaveLength(1);
    expect(topRoutes[0]?.id).toBe('t1');
  });
});
