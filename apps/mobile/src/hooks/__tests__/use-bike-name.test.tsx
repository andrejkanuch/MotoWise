// Ride detail and ride summary label the ride with its bike. The name comes from
// the bike list every other screen caches (Home, Garage, the persisted cache),
// so it must read that list's entry and keep watching it: a one-time read of a
// key nobody writes returned null forever, and a read taken before the list
// arrived stayed null after it did.

jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../lib/account-gone', () => ({
  isAccountGoneError: () => false,
  getRequestSessionUserId: () => null,
  signOutGoneAccount: jest.fn(),
}));
const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { resolveFailureHandling } from '../../lib/query-client';
import { queryKeys } from '../../lib/query-keys';
import { useBikeName } from '../use-bike-name';

const BIKES_KEY = queryKeys.motorcycles.all;
const NICKNAMED = { id: 'bike-a', nickname: 'Red', make: 'Honda', model: 'Africa Twin' };
const PLAIN = { id: 'bike-b', nickname: null, make: 'BMW', model: 'R 1250 GS' };
const LIST = { myMotorcycles: [NICKNAMED, PLAIN] } as unknown as MyMotorcyclesQuery;

let queryClient: QueryClient;

function renderBikeName(motorcycleId: string | null | undefined) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBikeName(motorcycleId), { wrapper });
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockFetcher.mockReset();
  mockFetcher.mockResolvedValue(LIST);
});

afterEach(() => {
  queryClient.clear();
});

describe('useBikeName', () => {
  it('returns the nickname from the bike list cached under the shared key', async () => {
    queryClient.setQueryData(BIKES_KEY, LIST);
    const { result } = await renderBikeName('bike-a');
    expect(result.current).toBe('Red');
  });

  it('returns make and model when the bike has no nickname', async () => {
    queryClient.setQueryData(BIKES_KEY, LIST);
    const { result } = await renderBikeName('bike-b');
    expect(result.current).toBe('BMW R 1250 GS');
  });

  it('shows the name once the list arrives after the screen opened', async () => {
    let deliver: (list: MyMotorcyclesQuery) => void = () => {};
    mockFetcher.mockImplementation(() => new Promise((resolve) => (deliver = resolve)));

    const { result } = await renderBikeName('bike-a');
    expect(result.current).toBeNull();

    deliver(LIST);
    await waitFor(() => expect(result.current).toBe('Red'));
  });

  it.each([
    ['an unknown id', 'bike-z'],
    ['a null id', null],
    ['an undefined id', undefined],
  ])('returns null for %s', async (_label, id) => {
    queryClient.setQueryData(BIKES_KEY, LIST);
    const { result } = await renderBikeName(id);
    expect(result.current).toBeNull();
  });

  it('asks for no global alert when the first load of the list fails', async () => {
    mockFetcher.mockRejectedValue(new Error('offline'));

    const { result } = await renderBikeName('bike-a');
    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(queryClient.getQueryCache().find({ queryKey: BIKES_KEY })?.state.status).toBe('error'),
    );

    expect(result.current).toBeNull();
    // The global handler decides over the query's observers; this one owns its
    // failure (a missing label), so it must not veto the opt-out.
    const query = queryClient.getQueryCache().find({ queryKey: BIKES_KEY });
    expect(resolveFailureHandling(query).alertOptOut).toBe(true);
  });
});
