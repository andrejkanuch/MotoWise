// The ride shape a recap card waits for before it is captured: a fetch paused
// offline settles as missing, so a share never waits on it forever.
const mockFetchRideBundle = jest.fn();
jest.mock('@/features/ride/fetch-ride-bundle', () => ({
  fetchRideBundle: (...args: unknown[]) => mockFetchRideBundle(...args),
}));

import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useRecapRideRoute } from '../use-recap-ride-route';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * The app's queries are `offlineFirst`: offline, the first attempt fails and the
 * retry pauses until the phone is back online, leaving the query pending.
 */
function offlineFirstWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 0, networkMode: 'offlineFirst' } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockFetchRideBundle.mockReset();
  onlineManager.setOnline(true);
});
afterAll(() => onlineManager.setOnline(true));

describe('useRecapRideRoute', () => {
  it('settles with the route once the ride loads', async () => {
    mockFetchRideBundle.mockResolvedValue({ ride: { routePolyline: 'abc' } });
    const { result } = await renderHook(() => useRecapRideRoute('ride-1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current).toEqual({ route: 'abc', settled: true, missing: false });
  });

  it('is complete for a ride that has no route', async () => {
    mockFetchRideBundle.mockResolvedValue({ ride: { routePolyline: null } });
    const { result } = await renderHook(() => useRecapRideRoute('ride-1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.missing).toBe(false);
  });

  it('settles as missing when the fetch is paused offline', async () => {
    onlineManager.setOnline(false);
    mockFetchRideBundle.mockRejectedValue(new Error('Network request failed'));
    const { result } = await renderHook(() => useRecapRideRoute('ride-1'), {
      wrapper: offlineFirstWrapper,
    });
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current).toEqual({ route: null, settled: true, missing: true });
  });

  it('settles as missing when the fetch fails', async () => {
    mockFetchRideBundle.mockRejectedValue(new Error('down'));
    const { result } = await renderHook(() => useRecapRideRoute('ride-1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.missing).toBe(true);
  });

  it('has nothing to wait for without a ride', async () => {
    const { result } = await renderHook(() => useRecapRideRoute(null), { wrapper });
    expect(result.current).toEqual({ route: null, settled: true, missing: false });
  });
});
