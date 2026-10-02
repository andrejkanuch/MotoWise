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
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => ({
  ...require('../../../test/mocks').mockAnalytics(),
  addBreadcrumb: jest.fn(),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../../../lib/notifications', () => ({
  cancelDocumentNotificationsForBike: jest.fn(),
}));
jest.mock('../../../lib/image-upload', () => ({
  pickImage: jest.fn(),
  takePhoto: jest.fn(() => Promise.resolve('file:///photo.jpg')),
  uploadBikePhoto: jest.fn(() => Promise.resolve({ publicUrl: 'https://example.test/p.jpg' })),
}));
jest.mock('../../../stores/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ session: { user: { id: 'user-1' } } }),
}));
const mockActionSheet = jest.fn();
jest.mock('../../../utils/action-sheet', () => ({
  showActionSheet: (...args: unknown[]) => mockActionSheet(...args),
}));

import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { HUB_UNIT, NOTE_SOURCE } from '../../../lib/bike-hub/constants';
import { userFriendlyError } from '../../../lib/graphql-errors';
import { queryClient, resolveFailureHandling } from '../../../lib/query-client';
import { queryKeys } from '../../../lib/query-keys';
import { QUERY_META } from '../../../lib/query-meta';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { DocumentsSection } from '../documents-section';
import {
  useCreateNote,
  useCreateTaskFromNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from '../notes/use-notes';
import { useOverviewData } from '../overview/use-overview-data';
import { useLogOdometer, useOdometerContext } from '../sheets/use-log-odometer';
import { useBikeActions } from '../shell/use-bike-actions';
import { type HubBike, useBikeHubData } from '../shell/use-bike-hub-data';
import { useBikePhoto } from '../shell/use-bike-photo';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/**
 * Long enough for every retry of the app client: queries retry 3 times with
 * `retryDelay = 1000 * 2 ** failureCount`, i.e. 2 + 4 + 8 s for failureCount 1–3.
 */
const ALL_RETRIES_MS = 30_000;
const settle = () => act(async () => jest.advanceTimersByTimeAsync(ALL_RETRIES_MS));
const API_DOWN = new Error('API is down');
const GLOBAL_ALERT_MESSAGE = userFriendlyError(API_DOWN);

let alert: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFetcher.mockImplementation(() => Promise.reject(API_DOWN));
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

describe('the opt-out does not depend on which observer rendered last', () => {
  // Observers of one key share one Query, and every render writes that
  // observer's options (meta included) onto it — so `query.meta` is whoever
  // rendered last. The handler must decide over every observer instead.
  const KEY = ['shared-key'];
  const optedOut = () =>
    useQuery({ queryKey: KEY, queryFn: () => mockFetcher(), meta: QUERY_META.OWN_ERROR_UI });
  const plain = () => useQuery({ queryKey: KEY, queryFn: () => mockFetcher() });

  it.each([
    ['opted-out first, plain last', [optedOut, plain]],
    ['plain first, opted-out last', [plain, optedOut]],
  ] as const)('%s: an observer without its own error UI keeps the alert', async (_name, hooks) => {
    await renderHook(() => hooks.map((useHook) => useHook()), { wrapper });
    await settle();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Error', GLOBAL_ALERT_MESSAGE);
  });

  it('a disabled observer without meta does not veto the opt-out (it never asked for the fetch)', async () => {
    const disabledPlain = () =>
      useQuery({ queryKey: KEY, queryFn: () => mockFetcher(), enabled: false });
    await renderHook(() => [disabledPlain(), optedOut()], { wrapper });
    await settle();
    expect(queryClient.getQueryCache().find({ queryKey: KEY })?.state.status).toBe('error');
    expect(alert).not.toHaveBeenCalled();
  });

  it('every observer opted out: no alert', async () => {
    await renderHook(() => [optedOut(), optedOut()], { wrapper });
    await settle();
    expect(queryClient.getQueryCache().find({ queryKey: KEY })?.state.status).toBe('error');
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('bike hub cold open with the API down and nothing cached', () => {
  const renderHub = () =>
    renderHook(
      () => {
        const shell = useBikeHubData(BIKE_A.id);
        const overview = useOverviewData(BIKE_A as unknown as HubBike, shell, HUB_UNIT.KM);
        return { shell, overview };
      },
      { wrapper },
    );

  it('raises zero alerts while every block shows its own error', async () => {
    const { result } = await renderHub();
    await settle();
    const { shell, overview } = result.current;
    expect(shell.isError).toBe(true);
    expect(shell.tasksError).toBe(true);
    expect(shell.documentsError).toBe(true);
    expect(overview.statusSource.isError).toBe(true);
    expect(overview.tasks.isError).toBe(true);
    expect(overview.costs.isError).toBe(true);
    expect(overview.notes.isError).toBe(true);
    expect(overview.recallsKnown).toBe(false);
    // Every query really ran its retries and failed with nothing cached.
    const statuses = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.state.status);
    expect(statuses.length).toBeGreaterThanOrEqual(9);
    expect(new Set(statuses)).toEqual(new Set(['error']));
    expect(alert).not.toHaveBeenCalled();
  });

  const year = new Date().getFullYear();
  it.each([
    ['bike list', queryKeys.motorcycles.all],
    ['tasks', queryKeys.maintenanceTasks.byMotorcycle(BIKE_A.id)],
    ['documents', queryKeys.documents.byMotorcycle(BIKE_A.id)],
    ['rides', queryKeys.rides.byMotorcycle(BIKE_A.id)],
    ['recalls', queryKeys.motorcycleRecalls.byMotorcycle(BIKE_A.id)],
    ['document categories', queryKeys.documents.categories(true)],
    ['expenses this year', [...queryKeys.expenses.byMotorcycle(BIKE_A.id), year]],
    ['expenses last year', [...queryKeys.expenses.byMotorcycle(BIKE_A.id), year - 1]],
    ['notes', queryKeys.notes.byMotorcycle(BIKE_A.id)],
  ] as const)('the %s query is opted out of the global alert', async (_name, queryKey) => {
    await renderHub();
    await settle();
    const query = queryClient.getQueryCache().find({ queryKey, exact: true });
    expect(query?.state.status).toBe('error');
    expect(resolveFailureHandling(query).alertOptOut).toBe(true);
  });
});

describe('bike hub cold open on the Bike segment (remembered) with the API down', () => {
  // The remembered segment mounts first: the Bike segment's legacy documents
  // section then observes the documents and categories keys WITHOUT the
  // Overview's observers — it must opt out and show its own error itself.
  it('the documents section raises no alert and shows its own error with Retry', async () => {
    await render(
      <QueryClientProvider client={queryClient}>
        <DocumentsSection motorcycleId={BIKE_A.id} bikeName="Africa Twin" />
      </QueryClientProvider>,
    );
    await settle();
    for (const queryKey of [
      queryKeys.documents.byMotorcycle(BIKE_A.id),
      queryKeys.documents.categories(true),
    ]) {
      const query = queryClient.getQueryCache().find({ queryKey, exact: true });
      expect(query?.state.status).toBe('error');
      expect(resolveFailureHandling(query).alertOptOut).toBe(true);
    }
    expect(alert).not.toHaveBeenCalled();
    // i18n is not initialised in this file (other tests read the `defaultValue`
    // fallbacks), so copy renders as its key.
    expect(screen.getByTestId('documents-load-error')).toHaveTextContent(
      /bikeHub\.papers\.loadError/,
    );
    // Never the empty state for a list that failed to load.
    expect(screen.queryByText(/No documents yet|documents\.empty/)).toBeNull();

    const callsBefore = mockFetcher.mock.calls.length;
    await fireEvent.press(screen.getByRole('button', { name: /retry/i }));
    await settle();
    expect(mockFetcher.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('hub mutations whose caller shows its own alert do not get a second one', () => {
  it('useBikeActions.removeBike: only the confirm and the caller’s "Failed to delete"', async () => {
    const onRemoved = jest.fn();
    const { result } = await renderHook(
      () => useBikeActions(BIKE_A as unknown as HubBike, onRemoved),
      { wrapper },
    );
    await act(async () => result.current.removeBike());
    const [, , buttons] = alert.mock.calls[0] as [string, string, Array<{ onPress?: () => void }>];
    await act(async () => {
      buttons[1]?.onPress?.();
    });
    await settle();
    expect(mockFetcher).toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert).toHaveBeenLastCalledWith(
      'Error',
      'Failed to delete motorcycle. Please try again.',
    );
    expect(alert).not.toHaveBeenCalledWith('Error', GLOBAL_ALERT_MESSAGE);
  });

  it('useBikePhoto.changePhoto: only the caller’s "Failed to upload photo"', async () => {
    const { result } = await renderHook(() => useBikePhoto(BIKE_A.id), { wrapper });
    await act(async () => result.current.changePhoto());
    const [, options] = mockActionSheet.mock.calls[0] as [string, Array<{ onPress: () => void }>];
    await act(async () => {
      options[0]?.onPress();
    });
    await settle();
    expect(mockFetcher).toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Error', 'Failed to upload photo');
    expect(result.current.uploading).toBe(false);
  });
});
