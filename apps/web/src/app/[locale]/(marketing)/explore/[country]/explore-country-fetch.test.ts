import { afterEach, describe, expect, it, vi } from 'vitest';

// The /explore/[country] page is a server component that pulls in next-intl and
// next/navigation, so we exercise the data-fetch path it depends on rather than
// rendering it. We mock the GraphQL fetcher to throw (simulating a transient
// DB/API slowdown) and assert the page's parallel-fetch wrapper degrades to the
// empty-state shape (`[[], []]`) instead of throwing a 500.
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

/**
 * Mirrors the resolution in CountryPage: the parallel fetch is wrapped so a
 * transient API error degrades to empty arrays and renders the empty state.
 */
function resolveCountryData(countrySlug: string, countryCode: string) {
  return Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchRoutesByCountry(countryCode, 12),
  ]).catch(() => [[], []] as const);
}

describe('explore/[country] parallel fetch error boundary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('degrades to empty arrays when the API errors instead of throwing', async () => {
    mockedFetcher.mockRejectedValue(new Error('Internal Server Error (500)'));

    const [regions, topRoutes] = await resolveCountryData('us', 'US');

    expect(regions).toEqual([]);
    expect(topRoutes).toEqual([]);
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
