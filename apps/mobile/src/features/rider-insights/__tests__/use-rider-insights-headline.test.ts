// The Home headline query: its own cache entry, refreshed with Rider insights,
// and persisted for an offline cold start.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { GetRiderInsightsHeadlineDocument } from '@motovault/graphql';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { shouldDehydratePersistedQuery } from '@/lib/query-persist';
import { freeInsights } from '@/test/rider-insights-fixtures';
import { riderInsightsOptions, riderInsightsWindowOptions } from '../use-rider-insights';
import { riderInsightsHeadlineOptions } from '../use-rider-insights-headline';

const TIME_ZONE = 'Europe/Bratislava';

describe('riderInsightsHeadlineOptions', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockFetcher.mockReset();
    mockFetcher.mockResolvedValue({ riderInsights: freeInsights() });
  });

  it('asks for the headline document in the device time zone', async () => {
    await client.fetchQuery(riderInsightsHeadlineOptions(TIME_ZONE));
    expect(mockFetcher).toHaveBeenCalledWith(GetRiderInsightsHeadlineDocument, {
      timeZone: TIME_ZONE,
    });
  });

  it('keeps its own entry, apart from the full season', () => {
    expect(riderInsightsHeadlineOptions(TIME_ZONE).queryKey).not.toEqual(
      riderInsightsOptions(TIME_ZONE).queryKey,
    );
  });

  it.each([
    ['Rider insights', riderInsightsOptions(TIME_ZONE).queryKey],
    ['every ride query', queryKeys.rides.all],
  ])('goes stale when %s is invalidated', async (_label, key) => {
    const options = riderInsightsHeadlineOptions(TIME_ZONE);
    await client.fetchQuery(options);
    await client.invalidateQueries({ queryKey: key, refetchType: 'none' });
    expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
  });

  it('is persisted for an offline cold start', async () => {
    const options = riderInsightsHeadlineOptions(TIME_ZONE);
    await client.fetchQuery(options);
    const query = client.getQueryCache().find({ queryKey: options.queryKey, exact: true });
    expect(query && shouldDehydratePersistedQuery(query)).toBe(true);
  });
});

describe('error surfaces', () => {
  // Every insights surface draws its own failed state; a global alert on top is a second one.
  it('opts every insights query out of the global error alert', () => {
    expect(riderInsightsOptions('Europe/Vienna').meta?.showErrorAlert).toBe(false);
    expect(riderInsightsHeadlineOptions('Europe/Vienna').meta?.showErrorAlert).toBe(false);
    expect(
      riderInsightsWindowOptions('Europe/Vienna', { from: '2025-01-01', to: '2025-12-31' }).meta
        ?.showErrorAlert,
    ).toBe(false);
  });
});
