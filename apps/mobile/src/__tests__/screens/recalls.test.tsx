// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));

jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());

let mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  AcknowledgeRecallDocument,
  MotorcycleRecallsDocument,
  type MyMotorcyclesQuery,
  UnacknowledgeRecallDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import '../../i18n';
import RecallsScreen from '../../app/(modals)/recalls';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import {
  type RecallItem,
  type RecallResultData,
  splitRecalls,
} from '../../lib/bike-hub/recall-acknowledgement';
import { queryKeys } from '../../lib/query-keys';

const mockTrackEvent = jest.mocked(trackEvent);
const BIKE_ID = 'bike-a';
const ACKED_AT = '2026-10-01T10:00:00.000Z';

function recall(campaignNumber: string, component: string, ackAt: string | null = null) {
  return {
    campaignNumber,
    component,
    reportDate: '2024-01-01',
    summary: `${component} summary`,
    consequence: 'consequence',
    remedy: 'remedy',
    acknowledged: ackAt !== null,
    acknowledgedAt: ackAt,
  } satisfies RecallItem;
}

function result(recalls: RecallItem[]): RecallResultData {
  const { open, done } = splitRecalls(recalls);
  return {
    count: open.length,
    acknowledgedCount: done.length,
    checkedAt: ACKED_AT,
    vinUsed: null,
    recalls: [...open, ...done],
  };
}

const BRAKES = recall('23V100000', 'BRAKES');
const FUEL = recall('24V200000', 'FUEL PUMP');
const LIGHTS_DONE = recall('25V300000', 'HEADLIGHT', ACKED_AT);

/** What the server returns for the recalls query: the refetch after an ack settles reads it. */
let mockServerRecalls: RecallResultData;

/** The recalls query answers from the server state; any other document from `other`. */
function serve(other: (document: unknown) => Promise<unknown> = () => Promise.resolve(undefined)) {
  mockFetcher.mockImplementation((document: unknown) =>
    document === MotorcycleRecallsDocument
      ? Promise.resolve({ motorcycleRecalls: mockServerRecalls })
      : other(document),
  );
}

async function renderScreen(initial: RecallResultData) {
  mockParams = { motorcycleId: BIKE_ID, bikeName: 'Honda' };
  mockServerRecalls = initial;
  serve();
  const client = new QueryClient({
    // Mutation gcTime Infinity: a finished mutation otherwise arms a 5-minute gc
    // timer that `clear()` does not cancel, keeping the Jest worker alive.
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: Infinity } },
  });
  const bikes: MyMotorcyclesQuery = {
    myMotorcycles: [{ id: BIKE_ID, recallCount: initial.count } as never],
  };
  // No garage-list observer on this screen: keep the seeded cache from being collected.
  client.setQueryDefaults(queryKeys.motorcycles.all, { gcTime: Number.POSITIVE_INFINITY });
  client.setQueryData(queryKeys.motorcycles.all, bikes);
  await render(
    <QueryClientProvider client={client}>
      <RecallsScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.queryByText('Checking NHTSA database…')).toBeNull());
  return client;
}

/** Presses the confirm button of the native "Mark as done?" alert. */
async function confirmAlert(alert: jest.SpyInstance) {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  const confirm = buttons.find((button) => button.style !== 'cancel');
  await act(async () => {
    confirm?.onPress?.();
  });
}

/** Lets the refetch after the last ack settles, and TanStack's batched notifications, land inside act. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
  mockFetcher.mockReset();
  mockTrackEvent.mockReset();
});

describe('Recalls screen — mark as done', () => {
  it('shows open recalls with a Mark as done action and done ones collapsed', async () => {
    await renderScreen(result([BRAKES, FUEL, LIGHTS_DONE]));

    expect(screen.getByText('2 open recalls found')).toBeOnTheScreen();
    expect(screen.getByTestId('recall-mark-done-23V100000')).toBeOnTheScreen();
    expect(screen.getByText('Done (1)')).toBeOnTheScreen();
    // Collapsed by default.
    expect(screen.queryByTestId('recall-done-25V300000')).toBeNull();

    await fireEvent.press(screen.getByTestId('recalls-done-toggle'));
    expect(screen.getByTestId('recall-done-25V300000')).toBeOnTheScreen();
    expect(screen.getByText(/Marked done/)).toBeOnTheScreen();
  });

  it('asks for confirmation, then marks the recall as done optimistically', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const client = await renderScreen(result([BRAKES, FUEL]));
    let resolveAck: (value: unknown) => void = () => {};
    serve((document) =>
      document === AcknowledgeRecallDocument
        ? new Promise((resolve) => {
            resolveAck = resolve;
          })
        : Promise.resolve(undefined),
    );

    await fireEvent.press(screen.getByTestId('recall-mark-done-23V100000'));
    expect(alert).toHaveBeenCalledWith(
      'Mark this recall as done?',
      expect.stringContaining('23V100000'),
      expect.any(Array),
    );
    expect(mockFetcher).not.toHaveBeenCalledWith(AcknowledgeRecallDocument, expect.anything());

    await confirmAlert(alert);

    // Optimistic: the card leaves the open list and the bike's count drops at once.
    await waitFor(() => expect(screen.getByText('1 open recall found')).toBeOnTheScreen());
    expect(screen.queryByTestId('recall-mark-done-23V100000')).toBeNull();
    expect(screen.getByText('Done (1)')).toBeOnTheScreen();
    expect(
      client.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all)?.myMotorcycles[0]
        ?.recallCount,
    ).toBe(1);
    expect(mockFetcher).toHaveBeenCalledWith(AcknowledgeRecallDocument, {
      motorcycleId: BIKE_ID,
      campaignNumber: '23V100000',
    });

    mockServerRecalls = result([FUEL, { ...BRAKES, acknowledged: true, acknowledgedAt: ACKED_AT }]);
    await act(async () => {
      resolveAck({ acknowledgeRecall: mockServerRecalls });
    });
    await flush();
    expect(mockTrackEvent).toHaveBeenCalledWith(AnalyticsEvent.RECALL_ACKNOWLEDGED, {
      campaign_number: '23V100000',
      motorcycle_id: BIKE_ID,
    });
  });

  it('rolls back and shows an error when the server rejects', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const client = await renderScreen(result([BRAKES]));
    serve((document) =>
      document === AcknowledgeRecallDocument
        ? Promise.reject(new Error('network'))
        : Promise.resolve(undefined),
    );

    await fireEvent.press(screen.getByTestId('recall-mark-done-23V100000'));
    await confirmAlert(alert);
    await flush();

    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'Error',
        "Couldn't update this recall. Please try again.",
      ),
    );
    expect(screen.getByTestId('recall-mark-done-23V100000')).toBeOnTheScreen();
    expect(screen.getByText('1 open recall found')).toBeOnTheScreen();
    expect(
      client.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all)?.myMotorcycles[0]
        ?.recallCount,
    ).toBe(1);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('Undo reopens a done recall', async () => {
    await renderScreen(result([LIGHTS_DONE]));
    expect(screen.getByText('No open recalls found')).toBeOnTheScreen();
    expect(screen.getByText('Every recall for this bike is marked as done.')).toBeOnTheScreen();
    mockServerRecalls = result([{ ...LIGHTS_DONE, acknowledged: false, acknowledgedAt: null }]);
    serve((document) =>
      document === UnacknowledgeRecallDocument
        ? Promise.resolve({ unacknowledgeRecall: mockServerRecalls })
        : Promise.resolve(undefined),
    );

    await fireEvent.press(screen.getByTestId('recalls-done-toggle'));
    await fireEvent.press(screen.getByTestId('recall-undo-25V300000'));
    await flush();

    await waitFor(() => expect(screen.getByText('1 open recall found')).toBeOnTheScreen());
    expect(screen.getByTestId('recall-mark-done-25V300000')).toBeOnTheScreen();
    expect(mockFetcher).toHaveBeenCalledWith(UnacknowledgeRecallDocument, {
      motorcycleId: BIKE_ID,
      campaignNumber: '25V300000',
    });
    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith(AnalyticsEvent.RECALL_UNACKNOWLEDGED, {
        campaign_number: '25V300000',
        motorcycle_id: BIKE_ID,
      }),
    );
  });
});
