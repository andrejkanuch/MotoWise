jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  DocumentsByMotorcycleDocument,
  MaintenancePriority,
  MaintenanceTaskSource,
  MaintenanceTaskStatus,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
  MyRidesDocument,
} from '@motovault/graphql';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { useCreateTaskFromNote, useDeleteNote, useUpdateNote } from '../notes/use-notes';
import { useLogOdometer } from '../sheets/use-log-odometer';
import { useBikeHubData } from '../shell/use-bike-hub-data';
import { refreshToday } from '../shell/use-today';

const clients: QueryClient[] = [];

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function newClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  onlineManager.setOnline(true);
  jest.useRealTimers();
});

describe('useBikeHubData — "loading" means "no data yet"', () => {
  it('offline cold open: queries are pending and paused (not fetching, no error) and still count as loading', async () => {
    // What `networkMode: offlineFirst` + retries leaves behind offline: a query
    // that is pending but paused. `isLoading` is false for it.
    onlineManager.setOnline(false);
    const client = newClient();
    const { result } = await renderHook(() => useBikeHubData(BIKE_A.id), {
      wrapper: wrapperFor(client),
    });
    const tasksQuery = client.getQueryCache().find({
      queryKey: ['maintenance-tasks', 'motorcycle', BIKE_A.id],
    });
    expect(tasksQuery?.state).toMatchObject({ status: 'pending', fetchStatus: 'paused' });
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result.current.tasksLoading).toBe(true);
    expect(result.current.documentsLoading).toBe(true);
    expect(result.current.tasksError).toBe(false);
    expect(result.current.documentsError).toBe(false);
  });

  it('once the lists are in, an empty list is a loaded, empty list', async () => {
    mockFetcher.mockImplementation((document: unknown) => {
      if (document === MyMotorcyclesDocument) return Promise.resolve({ myMotorcycles: [BIKE_A] });
      if (document === MaintenanceTasksByMotorcycleDocument) {
        return Promise.resolve({ maintenanceTasks: [] });
      }
      if (document === DocumentsByMotorcycleDocument) return Promise.resolve({ documents: [] });
      if (document === MyRidesDocument) return Promise.resolve({ myRides: { totalCount: 0 } });
      return Promise.resolve(undefined);
    });
    const client = newClient();
    const { result } = await renderHook(() => useBikeHubData(BIKE_A.id), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.tasksLoading).toBe(false));
    await waitFor(() => expect(result.current.documentsLoading).toBe(false));
  });
});

describe('useBikeHubData — the Service badge follows the shared "today"', () => {
  it('a High task due tomorrow is not counted today and is counted once the day has passed', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date(2026, 9, 2, 10, 0));
    await act(async () => refreshToday());
    const dueTomorrow = {
      id: 'task-1',
      title: 'Brake pads',
      priority: MaintenancePriority.High,
      status: MaintenanceTaskStatus.Pending,
      source: MaintenanceTaskSource.User,
      dueDate: '2026-10-03',
      targetMileage: null,
    };
    const client = newClient();
    client.setQueryData(['motorcycles'], { myMotorcycles: [BIKE_A] });
    client.setQueryData(['maintenance-tasks', 'motorcycle', BIKE_A.id], {
      maintenanceTasks: [dueTomorrow],
    });
    mockFetcher.mockImplementation(() => new Promise(() => {}));
    const { result } = await renderHook(() => useBikeHubData(BIKE_A.id), {
      wrapper: wrapperFor(client),
    });
    expect(result.current.serviceBadge).toBe(0);

    // The hub was left open; two days later the rider comes back to it.
    jest.setSystemTime(new Date(2026, 9, 4, 8, 0));
    await act(async () => refreshToday());
    expect(result.current.serviceBadge).toBe(1);
  });
});

describe('hub mutations keep the global error alert out of the way', () => {
  // The query client alerts "Error" for any failed mutation without `onError`
  // in its options, unless it opts out. These four show their own error UI and
  // opt out through `meta`, not through an incidental `onError` — except
  // `useLogOdometer`, whose `onError` parks a reading whose sheet is gone (it
  // shows no UI, so the opt-out must still come from `meta`).
  it.each([
    ['useUpdateNote', () => useUpdateNote(BIKE_A.id), false],
    ['useDeleteNote', () => useDeleteNote(BIKE_A.id), false],
    ['useCreateTaskFromNote', () => useCreateTaskFromNote(BIKE_A.id), false],
    ['useLogOdometer', () => useLogOdometer(BIKE_A.id), true],
  ] as const)('%s opts out with meta.showErrorAlert = false', async (_name, useHook, parks) => {
    mockFetcher.mockRejectedValue(new Error('offline'));
    const client = newClient();
    const { result } = await renderHook(() => useHook(), { wrapper: wrapperFor(client) });
    await act(async () => {
      (result.current.mutate as (variables: unknown) => void)({
        id: 'note-1',
        text: 'x',
        odometer: null,
        value: 1,
        recordedAt: new Date(),
        today: new Date(),
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const [mutation] = client.getMutationCache().getAll();
    expect(mutation?.meta).toEqual({ showErrorAlert: false });
    expect(mutation?.options.onError === undefined).toBe(!parks);
  });
});
