/**
 * The Get Started card ticks the items the rider's own data already proves
 * (a bike photo, a finished ride, an expense, a receipt scan), reports each
 * once, and renders nothing until that data has settled, so it never flashes
 * "0 of 5" and then ticks itself.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  ExpenseDashboardDocument,
  MyMotorcyclesDocument,
  MyRidesDocument,
  ReceiptScanQuotaDocument,
  RideStatus,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import {
  ALL_CHECKLIST_ITEMS,
  CHECKLIST_COMPLETION_TRIGGER,
  CHECKLIST_ITEM_ID,
  useChecklistStore,
} from '@/stores/checklist.store';
import { OnboardingChecklist } from '../onboarding-checklist';

const BIKE_ID = 'bike-1';
/** Five items, as `initialize` builds them: four the data can tick, one it cannot. */
const CARD_ITEMS = [
  CHECKLIST_ITEM_ID.FIRST_RIDE,
  CHECKLIST_ITEM_ID.FIRST_EXPENSE,
  CHECKLIST_ITEM_ID.COMPLETE_BIKE,
  CHECKLIST_ITEM_ID.SCAN_RECEIPT,
  CHECKLIST_ITEM_ID.BROWSE_ROUTES,
] as const;

interface Garage {
  photo?: string | null;
  rideStatuses?: RideStatus[];
  expenseCount?: number;
  scansUsed?: number;
}

function serve({ photo = null, rideStatuses = [], expenseCount = 0, scansUsed = 0 }: Garage) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === MyMotorcyclesDocument) {
      return Promise.resolve({ myMotorcycles: [{ id: BIKE_ID, primaryPhotoUrl: photo }] });
    }
    if (document === MyRidesDocument) {
      return Promise.resolve({
        myRides: { edges: rideStatuses.map((status, i) => ({ node: { id: `r${i}`, status } })) },
      });
    }
    if (document === ExpenseDashboardDocument) {
      return Promise.resolve({ expenseDashboard: { expenseCount } });
    }
    if (document === ReceiptScanQuotaDocument) {
      return Promise.resolve({ receiptScanQuota: { used: scansUsed, limit: 3, resetDate: '' } });
    }
    return Promise.reject(new Error('unexpected document'));
  });
}

function showCard(ids: readonly string[] = CARD_ITEMS, completedItems: string[] = []) {
  useChecklistStore.setState({
    items: ids.map((id) => {
      const item = ALL_CHECKLIST_ITEMS.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`unknown item ${id}`);
      return item;
    }),
    completedItems,
    dismissed: false,
    initialized: true,
  });
}

const mounted: { unmount: () => unknown }[] = [];

async function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <OnboardingChecklist />
    </QueryClientProvider>,
  );
  mounted.push(view);
  return { client, view };
}

const completions = () =>
  jest
    .mocked(trackEvent)
    .mock.calls.filter(([event]) => event === AnalyticsEvent.CHECKLIST_ITEM_COMPLETED);

beforeEach(() => {
  jest.clearAllMocks();
  useChecklistStore.getState().reset();
});
// Unmount before the next test resets the shared store: a card left mounted
// would read the reset store and tick items into the next test.
afterEach(async () => {
  for (const view of mounted.splice(0)) await view.unmount();
});

describe('Get Started card, from the rider’s data', () => {
  it('ticks a bike with a photo, a finished ride, an expense and a scan — once each', async () => {
    serve({
      photo: 'https://example.test/bike.jpg',
      rideStatuses: [RideStatus.Completed],
      expenseCount: 2,
      scansUsed: 1,
    });
    showCard();
    await renderCard();

    expect(await screen.findByText('4 of 5')).toBeTruthy();
    expect(useChecklistStore.getState().completedItems.sort()).toEqual(
      [
        CHECKLIST_ITEM_ID.FIRST_RIDE,
        CHECKLIST_ITEM_ID.FIRST_EXPENSE,
        CHECKLIST_ITEM_ID.COMPLETE_BIKE,
        CHECKLIST_ITEM_ID.SCAN_RECEIPT,
      ].sort(),
    );
    expect(completions()).toHaveLength(4);
    for (const [, properties] of completions()) {
      expect(properties).toEqual(
        expect.objectContaining({ trigger: CHECKLIST_COMPLETION_TRIGGER.DATA, items_total: 5 }),
      );
    }
  });

  it('ticks nothing the data does not prove', async () => {
    // A bike without a photo, a ride still recording, no expense, no scan.
    serve({ rideStatuses: [RideStatus.Recording] });
    showCard();
    await renderCard();

    expect(await screen.findByText('0 of 5')).toBeTruthy();
    expect(useChecklistStore.getState().completedItems).toEqual([]);
    expect(completions()).toHaveLength(0);
  });

  it('does not report an item again on a later render or a remount', async () => {
    serve({ rideStatuses: [RideStatus.Completed] });
    showCard();
    const { client, view } = await renderCard();
    expect(await screen.findByText('1 of 5')).toBeTruthy();

    await act(async () => {
      await client.invalidateQueries();
    });
    mounted.splice(mounted.indexOf(view), 1);
    await view.unmount();
    await renderCard();
    expect(await screen.findByText('1 of 5')).toBeTruthy();

    expect(completions()).toHaveLength(1);
    expect(useChecklistStore.getState().completedItems).toEqual([CHECKLIST_ITEM_ID.FIRST_RIDE]);
  });

  it('keeps an item ticked by a tap as it was, without reporting it again', async () => {
    serve({ rideStatuses: [RideStatus.Completed] });
    showCard(CARD_ITEMS, [CHECKLIST_ITEM_ID.FIRST_RIDE]);
    await renderCard();

    expect(await screen.findByText('1 of 5')).toBeTruthy();
    expect(completions()).toHaveLength(0);
  });

  it('renders nothing while the data is still loading', async () => {
    mockFetcher.mockImplementation(() => new Promise(() => {}));
    showCard();
    await renderCard();

    expect(screen.queryByText('Get Started')).toBeNull();
  });

  it('still shows the card when the data fails to load', async () => {
    mockFetcher.mockImplementation(() => Promise.reject(new Error('API is down')));
    showCard();
    await renderCard();

    expect(await screen.findByText('0 of 5')).toBeTruthy();
    expect(completions()).toHaveLength(0);
  });

  it('hides the card when the data completes every item', async () => {
    serve({
      photo: 'https://example.test/bike.jpg',
      rideStatuses: [RideStatus.Completed],
      expenseCount: 1,
      scansUsed: 2,
    });
    showCard(CARD_ITEMS.filter((id) => id !== CHECKLIST_ITEM_ID.BROWSE_ROUTES));
    await renderCard();

    // Once the data is in, every item is ticked and the card stays hidden.
    await waitFor(() => expect(completions()).toHaveLength(4));
    expect(screen.queryByText('Get Started')).toBeNull();
  });

  it('runs no data query for items that are already done', async () => {
    serve({});
    showCard(
      [CHECKLIST_ITEM_ID.FIRST_RIDE, CHECKLIST_ITEM_ID.BROWSE_ROUTES],
      [CHECKLIST_ITEM_ID.FIRST_RIDE],
    );
    await renderCard();

    expect(await screen.findByText('1 of 2')).toBeTruthy();
    const documents = mockFetcher.mock.calls.map(([document]) => document);
    expect(documents).not.toContain(MyRidesDocument);
    expect(documents).not.toContain(ExpenseDashboardDocument);
    expect(documents).not.toContain(ReceiptScanQuotaDocument);
  });
});

describe('checklist store', () => {
  it('reports a tap with the tap trigger', () => {
    showCard();
    useChecklistStore.getState().completeItem(CHECKLIST_ITEM_ID.BROWSE_ROUTES);
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.CHECKLIST_ITEM_COMPLETED, {
      item: CHECKLIST_ITEM_ID.BROWSE_ROUTES,
      items_completed: 1,
      items_total: 5,
      trigger: CHECKLIST_COMPLETION_TRIGGER.TAP,
    });
  });

  it('reset (run when a different account signs in) leaves no card', () => {
    showCard(CARD_ITEMS, [CHECKLIST_ITEM_ID.FIRST_RIDE]);
    useChecklistStore.getState().dismiss();
    useChecklistStore.getState().reset();
    expect(useChecklistStore.getState()).toEqual(
      expect.objectContaining({
        items: [],
        completedItems: [],
        dismissed: false,
        initialized: false,
      }),
    );
  });
});
