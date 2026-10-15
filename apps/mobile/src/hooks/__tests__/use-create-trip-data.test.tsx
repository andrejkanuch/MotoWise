// The trip editor's form copies the first trip data it sees and ignores later
// data. Its query entry outlived the editor, so re-opening it after a save
// seeded the form from the trip as it was before the save — the rider's edit
// looked lost until the background refetch landed, too late for the form.
// The editor must start from what the server has at that moment.

jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/store-review', () => ({
  REVIEW_ACTION: { EXPENSE_OR_TRIP: 'expense_or_trip' },
  recordReviewAction: jest.fn(),
}));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  type CreateTripWithWaypointsInput,
  TripDetailDocument,
  UpdateTripDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useCreateTripData } from '../use-create-trip-data';

const TRIP_ID = 'trip-a';
const tripVersion = (title: string) => ({ trip: { id: TRIP_ID, title } });

/** The trip as the server has it; the update mutation advances it. */
let serverTitle = 'Before the edit';

let queryClient: QueryClient;
const router = { back: jest.fn(), dismissAll: jest.fn() };

async function mountEditor(ids: { sourceTripId: string | undefined; tripId: string | undefined }) {
  const seenData: unknown[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () => {
      const data = useCreateTripData({
        ...ids,
        buildTripInput: () => ({ title: 'After the edit' }) as CreateTripWithWaypointsInput,
        difficulty: 'easy',
        waypointCount: 2,
        maxRiders: '10',
        router,
      });
      seenData.push(data.tripQuery.data);
      return data;
    },
    { wrapper },
  );
  return { hook, firstDefinedData: () => seenData.find((data) => data !== undefined) };
}

/** Lets the query cache drop an unobserved entry and batched notifications land. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const tripFetches = () =>
  mockFetcher.mock.calls.filter(([document]) => document === TripDetailDocument).length;

beforeEach(() => {
  serverTitle = 'Before the edit';
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mockFetcher.mockReset();
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === TripDetailDocument) return Promise.resolve(tripVersion(serverTitle));
    if (document === UpdateTripDocument) {
      serverTitle = 'After the edit';
      return Promise.resolve({ updateTrip: { id: TRIP_ID } });
    }
    return Promise.resolve({});
  });
});

afterEach(() => {
  queryClient.clear();
});

describe('useCreateTripData — the editor seeds from the server', () => {
  it('re-opened after a save, the first trip data the editor sees is the saved trip', async () => {
    const first = await mountEditor({ sourceTripId: TRIP_ID, tripId: TRIP_ID });
    await waitFor(() => expect(first.hook.result.current.tripQuery.data).toBeDefined());
    expect(first.firstDefinedData()).toEqual(tripVersion('Before the edit'));

    await act(async () => {
      await first.hook.result.current.updateMutation.mutateAsync();
    });
    expect(router.back).toHaveBeenCalledTimes(1);
    await first.hook.unmount();
    await settle();

    const second = await mountEditor({ sourceTripId: TRIP_ID, tripId: TRIP_ID });
    await waitFor(() => expect(second.hook.result.current.tripQuery.data).toBeDefined());
    expect(second.firstDefinedData()).toEqual(tripVersion('After the edit'));
    expect(tripFetches()).toBe(2);
    await second.hook.unmount();
  });

  it('clone mode (a source trip, no trip id) fetches the source fresh on each open', async () => {
    const first = await mountEditor({ sourceTripId: TRIP_ID, tripId: undefined });
    await waitFor(() => expect(first.hook.result.current.tripQuery.data).toBeDefined());
    await first.hook.unmount();
    await settle();

    serverTitle = 'Changed elsewhere';
    const second = await mountEditor({ sourceTripId: TRIP_ID, tripId: undefined });
    await waitFor(() => expect(second.hook.result.current.tripQuery.data).toBeDefined());
    expect(second.firstDefinedData()).toEqual(tripVersion('Changed elsewhere'));
    expect(tripFetches()).toBe(2);
    await second.hook.unmount();
  });

  it('with no source trip the query stays disabled', async () => {
    const { hook } = await mountEditor({ sourceTripId: undefined, tripId: undefined });
    await settle();
    expect(hook.result.current.tripQuery.fetchStatus).toBe('idle');
    expect(hook.result.current.tripQuery.data).toBeUndefined();
    expect(tripFetches()).toBe(0);
    await hook.unmount();
  });
});
