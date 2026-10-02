/**
 * The app's query client raises a global "Error" alert for a failed mutation
 * (unless it opts out or has `onError` in its options) and for a query that
 * fails with nothing cached (unless it opts out). The hub shows its own inline
 * errors, so nothing it owns may raise that alert on top.
 *
 * These run real operations through the app's REAL client (`lib/query-client`),
 * retries included — asserting a `meta` flag on a cache entry proved nothing
 * about what the rider sees: on device the alert beside "Couldn't save the
 * reading" came from the Odometer sheet's two QUERIES failing, not from the
 * save mutation.
 */
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => ({
  ...require('../../../test/mocks').mockAnalytics(),
  addBreadcrumb: jest.fn(),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { NOTE_SOURCE } from '../../../lib/bike-hub/constants';
import { queryClient } from '../../../lib/query-client';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import {
  useCreateNote,
  useCreateTaskFromNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from '../notes/use-notes';
import { useLogOdometer, useOdometerContext } from '../sheets/use-log-odometer';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** Long enough for every retry of the app client (queries: 3, backing off 1 + 2 + 4 s). */
const ALL_RETRIES_MS = 30_000;
const settle = () => act(async () => jest.advanceTimersByTimeAsync(ALL_RETRIES_MS));

let alert: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFetcher.mockImplementation(() => Promise.reject(new Error('API is down')));
});
afterEach(() => {
  queryClient.getMutationCache().clear();
  queryClient.clear();
  alert.mockRestore();
  jest.useRealTimers();
});

describe('control: the app client does alert for operations that have not opted out', () => {
  it('a query that fails with nothing cached raises the global alert', async () => {
    await renderHook(
      () => useQuery({ queryKey: ['control-query'], queryFn: () => mockFetcher() }),
      { wrapper },
    );
    await settle();
    expect(alert).toHaveBeenCalledWith('Error', expect.any(String));
  });
});

describe('hub mutations: a failure shows only the hub’s own error', () => {
  const now = new Date(2026, 9, 2, 12, 0);
  it.each([
    [
      'useLogOdometer',
      () => useLogOdometer(BIKE_A.id),
      {
        value: 39_407,
        recordedAt: now,
        today: now,
        delta: 1240,
        backdated: false,
        usedQuickAdd: false,
      },
    ],
    ['useUpdateNote', () => useUpdateNote(BIKE_A.id), { id: 'note-1', text: 'x', odometer: null }],
    ['useDeleteNote', () => useDeleteNote(BIKE_A.id), 'note-1'],
    ['useCreateTaskFromNote', () => useCreateTaskFromNote(BIKE_A.id), 'note-1'],
    [
      'useCreateNote',
      () => useCreateNote(),
      { motorcycleId: BIKE_A.id, text: 'x', odometer: null, source: NOTE_SOURCE.SHEET },
    ],
  ] as const)('%s fails through the real client, twice, without the global alert', async (_name, useHook, variables) => {
    const { result } = await renderHook(() => useHook(), { wrapper });
    for (const _attempt of ['first', 'again']) {
      await act(async () => {
        (result.current.mutate as (input: unknown) => void)(variables);
      });
      await settle();
      expect(result.current.isError).toBe(true);
    }
    // It really went out (and was retried by the client), and really failed.
    expect(mockFetcher.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('hub queries: a first-load failure shows only the hub’s own state', () => {
  it('the Odometer sheet’s readings and pending-rides queries fail without the global alert', async () => {
    const { result } = await renderHook(() => useOdometerContext(BIKE_A.id), { wrapper });
    await settle();
    expect(result.current.latest).toBeNull();
    expect(result.current.pendingRides).toBeNull();
    // Both queries ran their retries and ended in error with nothing cached.
    const failed = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['odometer'] })
      .map((query) => query.state.status);
    expect(failed).toEqual(['error', 'error']);
    expect(alert).not.toHaveBeenCalled();
  });

  it('the notes query fails without the global alert (the block shows its own Retry)', async () => {
    const { result } = await renderHook(() => useNotes(BIKE_A.id), { wrapper });
    await settle();
    expect(result.current.isError).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });
});
