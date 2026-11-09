// The ride summary's Rider insights card: the new-road distance for Pro once the
// ride's stats land (polled for at most 30 s), the blurred tile and season
// distance for everyone else, the paywall only when the ride-moment trigger
// allows it (once), and the keep-riding line below five qualifying rides.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/utils/haptics', () => ({ triggerSelection: jest.fn() }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    i18n: { language: 'en' },
  }),
}));
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockPresentPaywall = jest.fn(() => Promise.resolve('cancelled'));
jest.mock('@/lib/subscription', () => ({
  presentRiderInsightsPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));
let mockEvaluation: unknown = null;
jest.mock('../use-ride-teaser-evaluation', () => ({
  useRideTeaserEvaluation: () => mockEvaluation,
}));
jest.mock('react-native-view-shot', () => ({ captureRef: () => new Promise(() => {}) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: { testID?: string }) => <View testID={props.testID} /> };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Box, Svg: Box, Path: () => null };
});

import {
  GetRiderInsightsDocument,
  GetRideSummaryStatsDocument,
  type GetRideSummaryStatsQuery,
} from '@motovault/graphql';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { RIDER_INSIGHTS_ENTRY } from '@/config/routes';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { RIDE_TEASER_TRIGGER } from '@/lib/ride-milestone-trigger';
import { useAuthStore } from '@/stores/auth.store';
import {
  freeInsights,
  type InsightsPayload,
  newRiderInsights,
  proInsights,
} from '@/test/rider-insights-fixtures';
import {
  RideSummaryInsightsCard,
  SUMMARY_STATS_MAX_WAIT_MS,
  SUMMARY_STATS_POLL_MS,
  SUMMARY_TILE,
  summaryCardModel,
} from '../ride-summary-insights-card';

const RIDE_ID = 'ride-new';
/** 48 km, 36 min moving: a qualifying ride. */
const RIDE = { rideId: RIDE_ID, distanceM: 48_000, movingS: 2_160 };
const INSIGHTS_ROUTE = {
  pathname: '/(tabs)/(profile)/rider-insights',
  params: { entry: RIDER_INSIGHTS_ENTRY.RIDE_SUMMARY },
};
const DUE_TRIGGER = {
  trigger: RIDE_TEASER_TRIGGER.MILESTONE,
  wouldShow: true,
  shown: true,
  suppressionReason: null,
  qualifyingRideCount: 5,
  isQualifyingRide: true,
};

type SummaryRide = GetRideSummaryStatsQuery['ride'];
const pending: SummaryRide = { id: RIDE_ID, newRoadsM: null, stats: null };
const computed = (newRoadsM: number | null): SummaryRide => ({
  id: RIDE_ID,
  newRoadsM,
  stats: { climbM: 401 },
});

let client: QueryClient;
let rideAnswers: SummaryRide[];

function serve(insights: InsightsPayload, ...rides: SummaryRide[]) {
  rideAnswers = rides;
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === GetRiderInsightsDocument) return Promise.resolve({ riderInsights: insights });
    if (document === GetRideSummaryStatsDocument) {
      const ride = rideAnswers.length > 1 ? rideAnswers.shift() : rideAnswers[0];
      return Promise.resolve({ ride });
    }
    return Promise.reject(new Error('unexpected document'));
  });
}

async function renderCard(ride: typeof RIDE = RIDE) {
  return await render(
    <QueryClientProvider client={client}>
      <RideSummaryInsightsCard {...ride} />
    </QueryClientProvider>,
  );
}

const seasonLabel = () =>
  screen.getByTestId('ride-summary-insights-season').props.accessibilityLabel as string;

async function seasonLoaded(): Promise<string> {
  await waitFor(() => expect(seasonLabel()).toMatch(/\d/));
  return seasonLabel();
}

const rideFetches = () =>
  mockFetcher.mock.calls.filter(([document]) => document === GetRideSummaryStatsDocument).length;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockPresentPaywall.mockClear();
  mockRouter.push.mockReset();
  (trackEvent as jest.Mock).mockReset();
  mockEvaluation = null;
  onlineManager.setOnline(true);
  useAuthStore.setState({ measurementSystem: 'metric' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('summaryCardModel', () => {
  // freeInsights: 2,507 km over 36 rides, 20 qualifying, latest ride is not this one.
  it('adds this ride on the device while the season does not count it yet', () => {
    const model = summaryCardModel({ insights: freeInsights(), ...RIDE, newRoadsM: null });
    expect(model.seasonM).toBe(2_555_000);
  });

  it('does not add this ride twice once the season counts it', () => {
    const insights = freeInsights({
      totals: { rides: 37, distanceM: 2_555_000, countries: 2 },
      latestRide: { rideId: RIDE_ID, localDate: '2026-11-09', distanceM: 48_000, newCountries: [] },
    });
    expect(summaryCardModel({ insights, ...RIDE, newRoadsM: null }).seasonM).toBe(2_555_000);
  });

  it('a Pro ride with a real zero is new roads 0, not pending', () => {
    const model = summaryCardModel({ insights: proInsights(), ...RIDE, newRoadsM: 0 });
    expect(model).toMatchObject({ tile: SUMMARY_TILE.NEW_ROADS, newRoadsM: 0 });
  });

  it('a Pro ride with a null value is computing', () => {
    const model = summaryCardModel({ insights: proInsights(), ...RIDE, newRoadsM: null });
    expect(model.tile).toBe(SUMMARY_TILE.COMPUTING);
  });

  it('counts this qualifying ride toward five: four before it is enough', () => {
    const model = summaryCardModel({ insights: newRiderInsights(), ...RIDE, newRoadsM: null });
    expect(model.tile).toBe(SUMMARY_TILE.LOCKED);
  });

  it('is keep riding when this ride does not qualify and four came before', () => {
    const short = { ...RIDE, distanceM: 500, movingS: 60 };
    const model = summaryCardModel({ insights: newRiderInsights(), ...short, newRoadsM: null });
    expect(model.tile).toBe(SUMMARY_TILE.KEEP_RIDING);
  });
});

describe('a Pro rider', () => {
  it('sees this ride new-road distance once its stats land, and a tap opens Rider insights', async () => {
    jest.useFakeTimers();
    serve(proInsights(), pending, computed(35_500));
    await renderCard();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SUMMARY_STATS_POLL_MS);
    });

    const tile = await screen.findByTestId('ride-summary-insights-tile');
    await waitFor(() =>
      expect(screen.getByTestId('ride-summary-insights-tile').props.accessibilityLabel).toContain(
        '36 km',
      ),
    );
    await fireEvent.press(tile);
    expect(mockRouter.push).toHaveBeenCalledWith(INSIGHTS_ROUTE);
    expect(mockPresentPaywall).not.toHaveBeenCalled();
  });

  it('shows the device season distance and no number in the tile while pending', async () => {
    serve(proInsights(), pending);
    await renderCard();
    expect(await seasonLoaded()).toContain('2,555 km');
    const tile = screen.getByTestId('ride-summary-insights-tile');
    expect(tile.props.accessibilityLabel).toContain('insightsEntry.newRoadsComputing');
    expect(tile.props.accessibilityLabel).not.toMatch(/\d/);
  });

  it('shows a real zero as 0 km', async () => {
    serve(proInsights(), computed(0));
    await renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('ride-summary-insights-tile').props.accessibilityLabel).toContain(
        '0 km',
      ),
    );
  });

  it('stops asking for the ride after 30 s', async () => {
    jest.useFakeTimers();
    serve(proInsights(), pending);
    await renderCard();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SUMMARY_STATS_MAX_WAIT_MS + SUMMARY_STATS_POLL_MS);
    });
    const asked = rideFetches();
    expect(asked).toBeGreaterThan(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * SUMMARY_STATS_POLL_MS);
    });
    expect(rideFetches()).toBe(asked);
  });
});

describe('a free rider', () => {
  it('sees the blurred tile and the season distance, and a tap opens Rider insights when no trigger is due', async () => {
    serve(freeInsights(), pending);
    await renderCard();
    expect(await seasonLoaded()).toContain('2,555 km');
    const tile = screen.getByTestId('ride-summary-insights-tile');
    expect(tile.props.accessibilityLabel).toBe('insightsEntry.newRoadsLockedA11y');
    expect(
      within(tile).getByTestId('blur-capture-placeholder', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_SHOWN, {
      row: 'summary',
    });

    await fireEvent.press(tile);
    expect(mockRouter.push).toHaveBeenCalledWith(INSIGHTS_ROUTE);
    expect(mockPresentPaywall).not.toHaveBeenCalled();
  });

  it('with a due trigger opens the paywall once, then Rider insights', async () => {
    mockEvaluation = DUE_TRIGGER;
    serve(freeInsights(), pending);
    await renderCard();
    await seasonLoaded();

    await fireEvent.press(screen.getByTestId('ride-summary-insights-tile'));
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    expect(mockPresentPaywall).toHaveBeenCalledWith(
      'summary',
      expect.objectContaining({ headline: expect.stringContaining('2,555 km') }),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('ride-summary-insights-season'));
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith(INSIGHTS_ROUTE);
  });
});

describe('a rider below five qualifying rides', () => {
  it('sees season distance and the keep-riding line, no blurred tile, and no paywall even with a due trigger', async () => {
    mockEvaluation = DUE_TRIGGER;
    serve(newRiderInsights(), pending);
    await renderCard({ rideId: RIDE_ID, distanceM: 500, movingS: 60 });
    const label = await seasonLoaded();
    expect(label).toContain('riderInsights.howYouRide.keepRiding');
    expect(label).toContain('211 km');
    expect(screen.queryByTestId('ride-summary-insights-tile')).toBeNull();

    await fireEvent.press(screen.getByTestId('ride-summary-insights-season'));
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith(INSIGHTS_ROUTE);
  });
});
