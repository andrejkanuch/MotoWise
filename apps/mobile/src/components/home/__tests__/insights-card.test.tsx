// Home's Rider insights card: always a free number, hidden with no rides, the
// keep-riding line below five qualifying rides, and a tap opens the screen
// from the Home entry.
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

import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RIDER_INSIGHTS_ENTRY } from '@/config/routes';
import { useAuthStore } from '@/stores/auth.store';
import {
  freeInsights,
  type InsightsPayload,
  newRiderInsights,
  proInsights,
} from '@/test/rider-insights-fixtures';
import { HOME_INSIGHT, homeInsightHeadline, InsightsCard } from '../insights-card';

let client: QueryClient;

/** The card once the season has loaded: its label carries a number. */
async function loadedLabel(): Promise<string> {
  await waitFor(() =>
    expect(screen.getByTestId('home-insights-card').props.accessibilityLabel).toMatch(/\d/),
  );
  return screen.getByTestId('home-insights-card').props.accessibilityLabel;
}

async function renderCard(payload: InsightsPayload | null) {
  if (payload) mockFetcher.mockResolvedValue({ riderInsights: payload });
  else mockFetcher.mockReturnValue(new Promise(() => {}));
  return await render(
    <QueryClientProvider client={client}>
      <InsightsCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockRouter.push.mockReset();
  onlineManager.setOnline(true);
  useAuthStore.setState({ measurementSystem: 'metric' });
});

describe('homeInsightHeadline', () => {
  it('is the season distance and the latest ride when that ride added no country', () => {
    expect(homeInsightHeadline(freeInsights())).toEqual({
      kind: HOME_INSIGHT.SEASON,
      seasonM: 2_507_000,
      latestRideM: 64_000,
    });
  });

  it('names a country the latest ride added', () => {
    const insights = freeInsights({
      latestRide: {
        rideId: 'r-37',
        localDate: '2026-11-09',
        distanceM: 90_000,
        newCountries: ['SK'],
      },
    });
    expect(homeInsightHeadline(insights)).toEqual({
      kind: HOME_INSIGHT.NEW_COUNTRY,
      seasonM: 2_507_000,
      country: 'Slovakia',
    });
  });

  it('reads keep riding below five qualifying rides', () => {
    expect(homeInsightHeadline(newRiderInsights())).toEqual({
      kind: HOME_INSIGHT.KEEP_RIDING,
      seasonM: 210_000,
    });
  });

  it('hides the card when the season has no rides', () => {
    const empty = freeInsights({ totals: { rides: 0, distanceM: 0, countries: 0 } });
    expect(homeInsightHeadline(empty)).toBeNull();
  });
});

describe('InsightsCard', () => {
  it('shows the season distance and opens Rider insights from Home', async () => {
    await renderCard(freeInsights());
    const label = await loadedLabel();
    expect(label).toContain('2,507 km');
    expect(label).toContain('64 km');

    await fireEvent.press(screen.getByTestId('home-insights-card'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(profile)/rider-insights',
      params: { entry: RIDER_INSIGHTS_ENTRY.HOME },
    });
  });

  it('never shows a Pro value, even for a Pro rider', async () => {
    await renderCard(proInsights());
    // Pro territory and road character values in the fixture: none may reach Home.
    const label = await loadedLabel();
    expect(label).toContain('2,507 km');
    expect(label).not.toMatch(/km²|%|bends/);
  });

  it('reads the keep-riding line below five qualifying rides', async () => {
    await renderCard(newRiderInsights());
    const label = await loadedLabel();
    expect(label).toContain('riderInsights.howYouRide.keepRiding');
    expect(label).toContain('210 km');
  });

  it('is hidden with no rides this season', async () => {
    await renderCard(freeInsights({ totals: { rides: 0, distanceM: 0, countries: 0 } }));
    expect(screen.getByTestId('home-insights-card')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('home-insights-card')).toBeNull());
  });

  it('shows no number while loading', async () => {
    await renderCard(null);
    const card = screen.getByTestId('home-insights-card');
    expect(card.props.accessibilityLabel).not.toMatch(/\d/);
  });
});
