// useRiderInsights after a purchase: while the server still reads the rider as
// free, it is asked again every 10 s until it agrees or the 2-minute window
// closes, even when an ask fails; the window closing ends "unlocking" on its
// own; and the refreshed answer is never overwritten by an older plain fetch.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import type { GetRiderInsightsQueryVariables } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { freeInsights, type InsightsPayload, proInsights } from '@/test/rider-insights-fixtures';
import {
  deviceTimeZone,
  PURCHASE_REFRESH_INTERVAL_MS,
  PURCHASE_TRUST_WINDOW_MS,
  riderInsightsOptions,
  useRiderInsights,
} from '../use-rider-insights';

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const refreshAsks = () =>
  mockFetcher.mock.calls.filter(
    ([, variables]) => (variables as GetRiderInsightsQueryVariables).refreshEntitlement === true,
  ).length;

const answer = (insights: InsightsPayload) => Promise.resolve({ riderInsights: insights });

async function loaded() {
  const hook = await renderHook(() => useRiderInsights(), { wrapper });
  await waitFor(() => expect(hook.result.current.insights).not.toBeNull());
  return hook;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  useSubscriptionStore.setState({ isPro: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('after a purchase the server has not caught up with', () => {
  it('keeps asking every 10 s when an ask fails', async () => {
    jest.useFakeTimers();
    mockFetcher.mockImplementation(
      (_document: unknown, variables: GetRiderInsightsQueryVariables) =>
        variables.refreshEntitlement
          ? Promise.reject(new Error('offline'))
          : answer(freeInsights()),
    );
    const { result } = await loaded();

    await act(async () => {
      await result.current.onPurchased();
    });
    expect(refreshAsks()).toBe(1);
    expect(result.current.unlocking).toBe(true);

    // One act per interval: React applies the failure's state update when each act ends.
    for (const asked of [2, 3, 4]) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PURCHASE_REFRESH_INTERVAL_MS + 100);
      });
      expect(refreshAsks()).toBe(asked);
    }
  });

  it('stops reading as unlocking once the window closes, with no other render', async () => {
    jest.useFakeTimers();
    mockFetcher.mockImplementation(
      (_document: unknown, variables: GetRiderInsightsQueryVariables) =>
        variables.refreshEntitlement
          ? Promise.reject(new Error('offline'))
          : answer(freeInsights()),
    );
    const { result } = await loaded();
    await act(async () => {
      await result.current.onPurchased();
    });
    expect(result.current.unlocking).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(PURCHASE_TRUST_WINDOW_MS + 100);
    });
    expect(result.current.unlocking).toBe(false);

    const asked = refreshAsks();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3 * PURCHASE_REFRESH_INTERVAL_MS);
    });
    expect(refreshAsks()).toBe(asked);
  });

  it('a plain fetch still in flight cannot put the free answer back over the refreshed one', async () => {
    mockFetcher.mockImplementation(() => answer(freeInsights()));
    const { result } = await loaded();

    let settleStale: (value: unknown) => void = () => {};
    mockFetcher.mockImplementation(
      (_document: unknown, variables: GetRiderInsightsQueryVariables) =>
        variables.refreshEntitlement
          ? answer(proInsights())
          : new Promise((resolve) => {
              settleStale = resolve;
            }),
    );
    await act(async () => {
      void client.refetchQueries({ queryKey: riderInsightsOptions(deviceTimeZone()).queryKey });
    });
    await act(async () => {
      await result.current.onPurchased();
    });
    expect(result.current.insights?.isPro).toBe(true);

    await act(async () => {
      settleStale({ riderInsights: freeInsights() });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.insights?.isPro).toBe(true);
  });
});
