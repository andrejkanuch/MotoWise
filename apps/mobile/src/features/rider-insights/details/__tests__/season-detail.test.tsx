// The free Season page: its title, the months and weeks it lists, a week that
// opens to its own rides (paging back through My rides only as far as that
// week), the failed and retried load, and a ride that opens ride detail.
import type { ReactNode } from 'react';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/hooks/use-tab-bar-clearance', () => ({ useTabBarClearance: () => 120 }));

const mockRouter = { push: jest.fn() };
const mockScreenOptions: Record<string, unknown>[] = [];
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ group: 'season' }),
  useSegments: () => ['(tabs)', '(profile)', 'rider-insights', '[group]'],
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => {
      mockScreenOptions.push(options);
      return null;
    },
  },
  Redirect: () => null,
}));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('@/lib/subscription', () => ({ presentRiderInsightsPaywall: jest.fn() }));
jest.mock('react-native-view-shot', () => ({ captureRef: () => new Promise(() => {}) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: () => <View /> };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Box, Svg: Box, Path: () => null };
});

import {
  GetRiderInsightsDocument,
  MyRidesDocument,
  type MyRidesQuery,
  RideStatus,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import '@/i18n';
import RiderInsightsDetailRoute from '@/app/(tabs)/(profile)/rider-insights/[group]';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { freeInsights } from '@/test/rider-insights-fixtures';
import type { MyRide } from '../season-model';

type Page = MyRidesQuery;

function ride(id: string, name: string | null, local: Date, distanceM = 50_000): MyRide {
  return {
    id,
    status: RideStatus.Completed,
    name,
    startedAt: local.toISOString(),
    endedAt: null,
    distanceM,
    maxSpeedMps: null,
    avgSpeedMps: null,
    elevationGain: null,
    pausedDurationS: 0,
    autoPausedDurationS: 0,
    durationS: null,
    motorcycleId: null,
    routePolyline: null,
    routeThumbnailUri: null,
    gpsQuality: null,
  };
}

function page(rides: MyRide[], endCursor: string | null): Page {
  return {
    myRides: {
      totalCount: 7,
      edges: rides.map((node) => ({ cursor: node.id, node })),
      pageInfo: { hasNextPage: endCursor !== null, endCursor },
    },
  };
}

// The fixture's biggest week runs Mon 2 to Sun 8 March 2026.
const WEEK = '2026-03-02';
const RIDES = {
  november: ride('r-nov', 'Late autumn loop', new Date(2026, 10, 3, 10)),
  march10: ride('r-mar10', 'After the week', new Date(2026, 2, 10, 9)),
  saturday: ride('r-sat', 'Weekend Tatras Tour', new Date(2026, 2, 7, 8), 385_000),
  tuesday: ride('r-tue', null, new Date(2026, 2, 3, 17)),
  monday: ride('r-mon', 'Monday commute', new Date(2026, 2, 2, 7, 30)),
  february: ride('r-feb', 'Before the week', new Date(2026, 1, 27, 9)),
  january: ride('r-jan', 'New year ride', new Date(2026, 0, 3, 9)),
};

/** Newest first, as the API pages them: the week needs the third page to be complete. */
const PAGES: Record<string, Page> = {
  start: page([RIDES.november, RIDES.march10], 'p1'),
  p1: page([RIDES.saturday, RIDES.tuesday], 'p2'),
  p2: page([RIDES.monday, RIDES.february], 'p3'),
  p3: page([RIDES.january], null),
};

let pages: Record<string, Page> = PAGES;

const ridePagesAsked = () =>
  mockFetcher.mock.calls
    .filter(([doc]) => doc === MyRidesDocument)
    .map(([, vars]) => (vars as { after: string | null }).after);

let client: QueryClient;
let failPage: string | null = null;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockRouter.push.mockReset();
  mockScreenOptions.length = 0;
  failPage = null;
  pages = PAGES;
  useAuthStore.setState({ measurementSystem: 'metric' });
  mockFetcher.mockImplementation(async (doc: unknown, vars: { after?: string | null }) => {
    if (doc === GetRiderInsightsDocument) return { riderInsights: freeInsights() };
    const key = vars.after ?? 'start';
    if (key === failPage) {
      failPage = null;
      throw new Error('network');
    }
    return pages[key];
  });
});

async function openSeason() {
  await render(
    <QueryClientProvider client={client}>
      <RiderInsightsDetailRoute />
    </QueryClientProvider>,
  );
  await screen.findByTestId('rider-insights-detail-season');
  await waitFor(() => expect(screen.queryByTestId('detail-loading')).toBeNull());
}

describe('the season page', () => {
  it('is titled Season and shows the weeks ridden, each month so far and every week ridden', async () => {
    await openSeason();
    expect(mockScreenOptions.at(-1)?.title).toBe('Season');
    expect(screen.getByTestId('detail-hero').props.accessibilityLabel).toBe(
      '2 of 46 weeks ridden so far',
    );
    // January to the season's last day, 9 November, newest first.
    const months = screen.getAllByTestId(/^season-month-/).map((n) => n.props.testID);
    expect(months[0]).toBe('season-month-2026-11');
    expect(months.at(-1)).toBe('season-month-2026-01');
    expect(months).toHaveLength(11);
    expect(screen.getByTestId('season-month-2026-03').props.accessibilityLabel).toBe(
      'March, 3 rides, 385 km',
    );
    expect(screen.getByTestId('season-month-2026-02').props.accessibilityLabel).toBe(
      'February, No rides, –',
    );
    expect(screen.getByTestId(`season-week-${WEEK}`).props.accessibilityLabel).toBe(
      'Mar 2 to 8, 3 rides · Biggest week, 385 km',
    );
    expect(screen.getByTestId('season-week-2026-11-02').props.accessibilityLabel).toBe(
      'Nov 2 to 8, 1 ride, 64 km',
    );
    // Nothing asks for rides until a week is opened.
    expect(ridePagesAsked()).toEqual([]);
  });

  it('opens a week to its own rides, paging back only until the week is covered', async () => {
    await openSeason();
    const week = screen.getByTestId(`season-week-${WEEK}`);
    expect(week.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(week);

    const list = await screen.findByTestId('week-rides');
    expect(ridePagesAsked()).toEqual([null, 'p1', 'p2']);
    // Its own entry, 50 rides a page: My rides' list is never grown or touched.
    for (const [doc, vars] of mockFetcher.mock.calls) {
      if (doc === MyRidesDocument) expect(vars).toMatchObject({ first: 50 });
    }
    expect(client.getQueryData(queryKeys.rides.all)).toBeUndefined();
    expect(client.getQueryData(queryKeys.rides.week(WEEK))).toBeDefined();
    const shown = within(list)
      .getAllByTestId(/^week-ride-/)
      .map((n) => n.props.testID);
    expect(shown).toEqual(['week-ride-r-mon', 'week-ride-r-tue', 'week-ride-r-sat']);
    // An unnamed ride reads by its date.
    expect(within(list).getByText('Ride on Mar 3')).toBeTruthy();
    expect(screen.getByTestId(`season-week-${WEEK}`).props.accessibilityState).toMatchObject({
      expanded: true,
    });

    // A second tap closes it again.
    await fireEvent.press(screen.getByTestId(`season-week-${WEEK}`));
    expect(screen.queryByTestId('week-rides')).toBeNull();
  });

  it('opens ride detail from a ride in the week', async () => {
    await openSeason();
    await fireEvent.press(screen.getByTestId(`season-week-${WEEK}`));
    await fireEvent.press(await screen.findByTestId('week-ride-r-sat'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(modals)/ride-detail',
      params: { rideId: 'r-sat', source: 'rider_insights' },
    });
  });

  it('shows a failed page as an error with a retry that carries on paging', async () => {
    failPage = 'p1';
    await openSeason();
    await fireEvent.press(screen.getByTestId(`season-week-${WEEK}`));
    const error = await screen.findByTestId('week-rides-error');
    expect(screen.queryByTestId('week-rides')).toBeNull();

    await fireEvent.press(within(error).getByText('Try again'));
    const list = await screen.findByTestId('week-rides');
    expect(within(list).getAllByTestId(/^week-ride-/)).toHaveLength(3);
    expect(ridePagesAsked()).toEqual([null, 'p1', 'p1', 'p2']);
  });

  it('reads the recent week from the first page without paging further', async () => {
    await openSeason();
    await fireEvent.press(screen.getByTestId('season-week-2026-11-02'));
    const list = await screen.findByTestId('week-rides');
    expect(
      within(list)
        .getAllByTestId(/^week-ride-/)
        .map((n) => n.props.testID),
    ).toEqual(['week-ride-r-nov']);
    expect(ridePagesAsked()).toEqual([null]);
  });

  it('retries a failed first page', async () => {
    failPage = 'start';
    await openSeason();
    await fireEvent.press(screen.getByTestId(`season-week-${WEEK}`));
    const error = await screen.findByTestId('week-rides-error');
    await fireEvent.press(within(error).getByText('Try again'));
    const list = await screen.findByTestId('week-rides');
    expect(within(list).getAllByTestId(/^week-ride-/)).toHaveLength(3);
    expect(ridePagesAsked()).toEqual([null, null, 'p1', 'p2']);
  });

  it('says so when a week ridden has no finished ride left in the list', async () => {
    // The 2 Nov week's ride was deleted since the insights were computed.
    pages = { start: page([RIDES.march10], null) };
    await openSeason();
    await fireEvent.press(screen.getByTestId('season-week-2026-11-02'));
    const empty = await screen.findByTestId('week-rides-empty');
    expect(within(empty).getByText('No finished rides found for this week.')).toBeTruthy();
  });

  it('stops after 10 pages, shows what it searched and looks further back on request', async () => {
    // Ten pages of one ride each, all after the week; the eleventh reaches it.
    const after = (i: number) => ride(`r-late-${i}`, 'Later ride', new Date(2026, 9, 30 - i, 9));
    const cursors = ['start', ...Array.from({ length: 10 }, (_, i) => `c${i + 1}`)];
    pages = Object.fromEntries(
      cursors.map((cursor, i) => [
        cursor,
        i < 10
          ? page([after(i)], cursors[i + 1])
          : page([RIDES.saturday, RIDES.tuesday, RIDES.monday, RIDES.february], null),
      ]),
    );
    await openSeason();
    await fireEvent.press(screen.getByTestId(`season-week-${WEEK}`));
    const note = await screen.findByTestId('week-rides-truncated');
    expect(ridePagesAsked()).toHaveLength(10);
    expect(
      within(note).getByText('Searched your latest 10 rides. This week may have more.'),
    ).toBeTruthy();
    expect(screen.queryAllByTestId(/^week-ride-/)).toHaveLength(0);

    await fireEvent.press(within(note).getByText('Search older rides'));
    await waitFor(() => expect(screen.queryByTestId('week-rides-truncated')).toBeNull());
    const list = await screen.findByTestId('week-rides');
    expect(within(list).getAllByTestId(/^week-ride-/)).toHaveLength(3);
    expect(ridePagesAsked()).toHaveLength(11);
  });
});
