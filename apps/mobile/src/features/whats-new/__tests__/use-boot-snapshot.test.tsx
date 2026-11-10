// useBootSnapshot: nothing before the persisted cache restores; the expense and
// notes fetches are bounded and quiet; each page's data freezes the first time
// it is read; and nothing carries over to another signed-in rider.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  ExpensesByMotorcycleDocument,
  GetRiderInsightsDocument,
  type MyMotorcyclesQuery,
  NotesByMotorcycleDocument,
  type NotesByMotorcycleQuery,
} from '@motovault/graphql';
import type { Session } from '@supabase/supabase-js';
import { IsRestoringProvider, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { WHATS_NEW_TIMING } from '@/config/whats-new';
import { WHATS_NEW_DATA_KIND, WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { queryKeys } from '@/lib/query-keys';
import { EXPENSES_ALL_YEARS, expensesOptions, motorcyclesOptions } from '@/lib/query-options';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { BIKE_A } from '@/test/bike-hub-fixtures';
import { proInsights } from '@/test/rider-insights-fixtures';
import { WHATS_NEW_DATA_SOURCE } from '../build-boot-snapshot';
import { useBootSnapshot } from '../use-boot-snapshot';

type Note = NotesByMotorcycleQuery['notes'][number];

let client: QueryClient;
let restoring = false;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <IsRestoringProvider value={restoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  );
}

function signIn(id: string) {
  useAuthStore.setState({ session: { user: { id } } as unknown as Session });
}

function seedBike(bike = BIKE_A) {
  client.setQueryData(motorcyclesOptions().queryKey, {
    myMotorcycles: [bike],
  } as unknown as MyMotorcyclesQuery);
}

const expensesPayload = (description: string, date = '2026-10-28') => ({
  expenses: {
    ytdTotal: 0,
    currencyTotals: [],
    categories: [
      {
        category: 'fuel',
        total: 22.85,
        currencyTotals: [],
        expenses: [
          {
            id: `exp-${description}`,
            amount: 22.85,
            category: 'fuel',
            currency: 'EUR',
            description,
            itemName: null,
            maintenanceTaskId: null,
            date,
            createdAt: `${date}T10:00:00Z`,
          },
        ],
      },
    ],
  },
});

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    motorcycleId: BIKE_A.id,
    text: 'Chain slack 30 mm',
    odometer: null,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    linkedTaskId: null,
    linkedTaskTitle: null,
    linkedExpenseId: null,
    linkedExpenseAmount: null,
    linkedExpenseCurrency: null,
    photos: [],
    ...overrides,
  };
}

/** A promise the test resolves or rejects by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Lets settled fetches reach the hook's state. Reading a page freezes it, so the
 * tests wait here rather than polling `getPageData`.
 */
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** Answers each document with the given promise factory; anything else never settles. */
function answer(byDocument: Map<unknown, () => Promise<unknown>>) {
  mockFetcher.mockImplementation((document: unknown) => {
    const respond = byDocument.get(document);
    return respond ? respond() : new Promise(() => {});
  });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } } });
  restoring = false;
  mockFetcher.mockReset();
  useSubscriptionStore.setState({ isPro: false });
  useAuthStore.setState({ measurementSystem: 'metric', currency: 'USD' });
  signIn('user-a');
});

afterEach(() => {
  jest.useRealTimers();
  client.clear();
});

it('has no snapshot and starts no fetch while the cache is restoring', async () => {
  restoring = true;
  seedBike();
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });
  expect(result.current.ready).toBe(false);
  expect(result.current.boot).toBeNull();
  expect(result.current.getPageData(WHATS_NEW_FEATURE.RECEIPT_SCAN)).toBeNull();
  expect(mockFetcher).not.toHaveBeenCalled();
});

it('falls back to the example when the expense fetch runs out of time, quietly', async () => {
  jest.useFakeTimers();
  seedBike();
  answer(new Map());
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });
  expect(result.current.ready).toBe(true);
  expect(result.current.boot).toMatchObject({ kind: 'odo', value: BIKE_A.currentMileage });

  await act(async () => {
    jest.advanceTimersByTime(WHATS_NEW_TIMING.DATA_FETCH_TIMEOUT_MS);
  });

  expect(result.current.getPageData(WHATS_NEW_FEATURE.RECEIPT_SCAN)).toMatchObject({
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: WHATS_NEW_DATA_SOURCE.TIMED_OUT,
  });
  const query = client
    .getQueryCache()
    .find({ queryKey: expensesOptions(BIKE_A.id, EXPENSES_ALL_YEARS).queryKey });
  expect(query?.state.fetchStatus).toBe('idle');
  // With no observer, the global alert reads the fetch's own meta.
  expect(query?.meta).toEqual({ showErrorAlert: false });
});

it('asks for every year of expenses, without retrying a failure or raising an alert', async () => {
  seedBike();
  answer(new Map([[ExpensesByMotorcycleDocument, () => Promise.reject(new Error('down'))]]));
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });
  await flush();

  expect(result.current.getPageData(WHATS_NEW_FEATURE.RECEIPT_SCAN)).toMatchObject({
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: WHATS_NEW_DATA_SOURCE.TIMED_OUT,
  });
  const expenseCalls = mockFetcher.mock.calls.filter(
    ([doc]) => doc === ExpensesByMotorcycleDocument,
  );
  expect(expenseCalls).toEqual([
    [ExpensesByMotorcycleDocument, { motorcycleId: BIKE_A.id, year: EXPENSES_ALL_YEARS }],
  ]);
  const query = client
    .getQueryCache()
    .find({ queryKey: expensesOptions(BIKE_A.id, EXPENSES_ALL_YEARS).queryKey });
  // With no observer, the global alert reads the fetch's own meta.
  expect(query?.meta).toEqual({ showErrorAlert: false });
});

it("upgrades a page the rider has not reached yet, and freezes one they've seen", async () => {
  seedBike();
  const expenses = deferred<unknown>();
  const notes = deferred<unknown>();
  answer(
    new Map([
      [ExpensesByMotorcycleDocument, () => expenses.promise],
      [NotesByMotorcycleDocument, () => notes.promise],
    ]),
  );
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });

  // The notes page is viewed while its fetch is still out.
  expect(result.current.getPageData(WHATS_NEW_FEATURE.NOTES_PHOTOS)).toMatchObject({
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
  });

  // Both fetches land, from last year for the expense.
  await act(async () => {
    expenses.resolve(expensesPayload('Repsol', '2025-03-14'));
    notes.resolve({ notes: [note()] });
  });

  // The scan page had not been viewed: it shows the rider's own expense.
  expect(result.current.getPageData(WHATS_NEW_FEATURE.RECEIPT_SCAN)).toMatchObject({
    kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
    source: WHATS_NEW_DATA_SOURCE.FETCHED,
    place: 'Repsol',
    amount: '€22.85',
  });
  // The notes page keeps what the rider saw.
  expect(result.current.getPageData(WHATS_NEW_FEATURE.NOTES_PHOTOS)).toMatchObject({
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
  });
});

it('reports prior use from a fetched photo note and the cached scan quota', async () => {
  seedBike();
  client.setQueryData(queryKeys.receiptScans.quota, {
    receiptScanQuota: { used: 2, limit: 3, resetDate: '2026-12-01' },
  });
  answer(
    new Map([
      [
        NotesByMotorcycleDocument,
        () =>
          Promise.resolve({
            notes: [note({ photos: [{ id: 'p1', storagePath: 'p', publicUrl: 'u' }] })],
          }),
      ],
    ]),
  );
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });
  await waitFor(() =>
    expect(result.current.priorUse).toEqual([
      WHATS_NEW_FEATURE.RECEIPT_SCAN,
      WHATS_NEW_FEATURE.NOTES_PHOTOS,
    ]),
  );
});

it('fetches the full insights for a Pro rider and quotes the share of new roads', async () => {
  useSubscriptionStore.setState({ isPro: true });
  seedBike();
  client.setQueryData(queryKeys.rides.list('home'), {
    myRides: {
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: [{ cursor: 'c', node: { id: 'r', routePolyline: 'oqrfHqnvaBqAoCiAkC' } }],
    },
  });
  answer(
    new Map([[GetRiderInsightsDocument, () => Promise.resolve({ riderInsights: proInsights() })]]),
  );
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });
  await flush();
  expect(result.current.getPageData(WHATS_NEW_FEATURE.ROAD_ATLAS)).toMatchObject({
    kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
    source: WHATS_NEW_DATA_SOURCE.FETCHED,
    newRoadShare: '84%',
  });
});

it('never reuses a snapshot after the signed-in rider changes', async () => {
  seedBike();
  answer(
    new Map([[ExpensesByMotorcycleDocument, () => Promise.resolve(expensesPayload('Shell'))]]),
  );
  const { result } = await renderHook(() => useBootSnapshot(), { wrapper });
  await flush();
  expect(result.current.getPageData(WHATS_NEW_FEATURE.RECEIPT_SCAN)).toMatchObject({
    place: 'Shell',
  });

  answer(new Map([[ExpensesByMotorcycleDocument, () => Promise.resolve(expensesPayload('OMV'))]]));
  await act(async () => {
    client.clear();
    seedBike();
    signIn('user-b');
  });

  await flush();
  expect(result.current.getPageData(WHATS_NEW_FEATURE.RECEIPT_SCAN)).toMatchObject({
    place: 'OMV',
  });
});
