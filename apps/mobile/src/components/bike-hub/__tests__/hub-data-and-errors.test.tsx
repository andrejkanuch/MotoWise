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
import { Alert } from 'react-native';
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
  // in its options, unless it opts out. These four show their own error UI.
  it.each([
    ['useUpdateNote', () => useUpdateNote(BIKE_A.id)],
    ['useDeleteNote', () => useDeleteNote(BIKE_A.id)],
    ['useCreateTaskFromNote', () => useCreateTaskFromNote(BIKE_A.id)],
    ['useLogOdometer', () => useLogOdometer(BIKE_A.id)],
  ] as const)('%s opts out with meta.showErrorAlert = false', async (_name, useHook) => {
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
    expect(mutation?.options.onError).toBeUndefined();
  });
});

describe('a failed odometer save shows only the inline error (app mutation cache)', () => {
  it('the app\'s global handler raises no "Error" alert for it, on the first attempt or a retried one', async () => {
    // The app's own mutation cache is what raises the global alert. Run the
    // sheet's mutation to failure twice on a plain client, then hand each failed
    // mutation to the app's real handler.
    const { queryClient: appClient } = jest.requireActual('../../../lib/query-client') as {
      queryClient: QueryClient;
    };
    const globalOnError = appClient.getMutationCache().config.onError;
    expect(globalOnError).toBeDefined();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockFetcher.mockRejectedValue(new Error('offline'));
    const client = newClient();
    const { result } = await renderHook(() => useLogOdometer(BIKE_A.id), {
      wrapper: wrapperFor(client),
    });
    const variables = {
      value: 39_407,
      recordedAt: new Date(),
      today: new Date(),
      delta: 1240,
      backdated: false,
      usedQuickAdd: false,
    };
    for (const _attempt of ['first', 'retry']) {
      await act(async () => {
        await result.current.mutateAsync(variables).catch(() => {});
      });
    }
    const failed = client.getMutationCache().getAll();
    expect(failed.length).toBeGreaterThan(0);
    for (const mutation of failed) {
      globalOnError?.(new Error('offline'), variables, undefined, mutation as never, {} as never);
    }
    expect(alert).not.toHaveBeenCalled();

    // Control: the same handler does alert for a mutation that has not opted out.
    globalOnError?.(
      new Error('offline'),
      variables,
      undefined,
      { meta: undefined, options: {} } as never,
      {} as never,
    );
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
