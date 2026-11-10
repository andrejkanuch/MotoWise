// The season recap: seven story cards, three free and four Pro. A free rider
// sees the free cards with values and each Pro card as its title over a blur;
// tapping one opens the paywall. The season is the API's.
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
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({}),
  useSegments: () => ['(tabs)', '(profile)', 'rider-insights'],
  Stack: { Screen: () => null },
}));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentRiderInsightsPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));

jest.mock('react-native-view-shot', () => ({ captureRef: () => new Promise(() => {}) }));

const mockCapture = jest.fn();
jest.mock('@/components/share/render-share-card', () => ({
  captureShareImage: (...args: unknown[]) => mockCapture(...args),
  getExportCardDimensions: () => ({ width: 360, height: 640 }),
}));

const mockShareOpen = jest.fn();
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: (...args: unknown[]) => mockShareOpen(...args) },
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: (props: { testID?: string; blurRadius?: number }) => (
      <View testID={props.testID} blurRadius={props.blurRadius} />
    ),
  };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Box, Svg: Box, Path: () => null };
});

jest.mock('@rnmapbox/maps', () => {
  const { View } = require('react-native');
  const Pass = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return {
    __esModule: true,
    default: { MapView: Pass, Camera: () => null, ShapeSource: Pass, LineLayer: () => null },
  };
});

import { GetRideDocument, GetRiderInsightsDocument, RiderInsightsStatus } from '@motovault/graphql';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '@/i18n';
import RiderInsightsScreen from '@/app/(tabs)/(profile)/rider-insights';
import RiderInsightsRecapRoute from '@/app/(tabs)/(profile)/rider-insights/recap';
import { PROFILE_ROUTE } from '@/config/routes';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import {
  freeInsights,
  type InsightsPayload,
  proInsights,
  RIOJA_ROUTE,
} from '@/test/rider-insights-fixtures';
import { space } from '@/theme/spacing';
import { clearBlurCaptures } from '../../blur-capture';
import { RECAP_ASPECT } from '../recap-card';
import { EXPORT_READY_TIMEOUT_MS, recapCardWidth } from '../recap-screen';

const mockTrack = trackEvent as jest.Mock;
const FREE_CARDS = ['distance', 'countries', 'longest'];
const PRO_CARDS = ['rhythm', 'new-roads', 'twistiest', 'cost'];
const PRO_TITLES = ['Riding rhythm', 'New roads', 'Twistiest ride', 'Cost of riding'];

let client: QueryClient;
let payload: InsightsPayload;

function serve(insights: InsightsPayload) {
  payload = insights;
}

async function renderRecap() {
  return await render(
    <QueryClientProvider client={client}>
      <RiderInsightsRecapRoute />
    </QueryClientProvider>,
  );
}

/** Every text in a card plus its accessibility label, as one string. */
function readable(testID: string): string {
  const node = screen.getByTestId(testID);
  const texts = within(node)
    .queryAllByText(/.*/, { includeHiddenElements: true })
    .map((n) => n.props.children);
  return [node.props.accessibilityLabel, ...texts].flat().join(' ');
}

const twistiest = {
  rideId: '00000000-0000-4000-8000-000000000020',
  name: 'Saturday Evening Ride',
  localDate: '2026-10-10',
  distanceM: 51_700,
  bendsPer10km: 21.3,
};

function proWith(overrides: Partial<InsightsPayload> = {}): InsightsPayload {
  const pro = proInsights();
  return {
    ...pro,
    roadCharacter: {
      ...pro.roadCharacter,
      // biome-ignore lint/style/noNonNullAssertion: the Pro fixture always has road character detail
      detail: { ...pro.roadCharacter.detail!, twistiest: [twistiest] },
    },
    costPerKm: {
      status: RiderInsightsStatus.Ready,
      items: [
        {
          currency: 'EUR',
          spend: 340,
          expenseCount: 12,
          distanceM: 2_400_000,
          distanceSource: 'odometer',
          costPerKm: 0.1417,
        },
        {
          currency: 'USD',
          spend: 45,
          expenseCount: 2,
          distanceM: 1_500_000,
          distanceSource: 'tracked',
          costPerKm: 0.03,
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === GetRiderInsightsDocument) return Promise.resolve({ riderInsights: payload });
    if (document === GetRideDocument)
      return Promise.resolve({ ride: { id: 'ride', routePolyline: RIOJA_ROUTE } });
    return Promise.reject(new Error('unexpected document'));
  });
  mockPresentPaywall.mockReset();
  mockPresentPaywall.mockResolvedValue('cancelled');
  mockCapture.mockReset();
  mockShareOpen.mockReset();
  mockRouter.push.mockReset();
  mockTrack.mockReset();
  clearBlurCaptures();
  onlineManager.setOnline(true);
  useSubscriptionStore.setState({ isPro: false });
  useAuthStore.setState({ measurementSystem: 'metric' });
});

describe('a free rider', () => {
  it('sees the three free cards with their values', async () => {
    serve(freeInsights());
    await renderRecap();
    await screen.findByTestId('recap-card-distance');
    expect(readable('recap-card-distance')).toContain('2,507 km');
    expect(readable('recap-card-distance')).toContain('36 rides in 2026');
    expect(readable('recap-card-countries')).toContain('2 countries');
    expect(readable('recap-card-countries')).toContain('Slovakia');
    expect(readable('recap-card-longest')).toContain('385 km');
    expect(readable('recap-card-longest')).toContain('Weekend Tatras Tour');
    for (const [i, id] of FREE_CARDS.entries()) {
      expect(screen.getByTestId(`recap-label-${id}`)).toHaveTextContent(`Free · ${i + 1} of 7`);
    }
  });

  it('sees each Pro card as its title over a blur, with no number a screen reader can reach', async () => {
    serve(freeInsights());
    await renderRecap();
    await screen.findByTestId('recap-card-rhythm');
    for (const [i, id] of PRO_CARDS.entries()) {
      const card = screen.getByTestId(`recap-card-${id}`);
      expect(screen.getByTestId(`recap-label-${id}`)).toHaveTextContent(`Pro · ${i + 4} of 7`);
      expect(card.props.accessibilityLabel).toBe(`${PRO_TITLES[i]}, Pro. Opens the paywall`);
      expect(within(card).getByText(PRO_TITLES[i])).toBeTruthy();
      expect(
        within(card).getByTestId('blur-capture-placeholder', { includeHiddenElements: true }),
      ).toBeTruthy();
      // The rhythm headline (60%) and road-character headline (21) never reach the card.
      expect(readable(`recap-card-${id}`).replace('Pro', '')).not.toMatch(/\d/);
    }
  });

  it('opens the paywall straight from a locked card, naming the row', async () => {
    serve(freeInsights());
    await renderRecap();
    fireEvent.press(await screen.findByTestId('recap-card-rhythm'));
    await waitFor(() => expect(mockPresentPaywall).toHaveBeenCalledTimes(1));
    expect(mockPresentPaywall.mock.calls[0][0]).toBe('rhythm');
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, {
      row: 'rhythm',
      surface: 'recap',
    });
  });

  it('opens the cost paywall from the locked cost card, quoting only free numbers', async () => {
    serve(freeInsights());
    await renderRecap();
    fireEvent.press(await screen.findByTestId('recap-card-cost'));
    await waitFor(() => expect(mockPresentPaywall).toHaveBeenCalledTimes(1));
    expect(mockPresentPaywall.mock.calls[0]).toEqual([
      'cost',
      {
        headline: '2,507 km this season',
        subhead: 'Pro works out your cost per km, from your fuel and service spend.',
      },
    ]);
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, {
      row: 'cost',
      surface: 'recap',
    });
  });
});

describe('a Pro rider', () => {
  it('sees every Pro card with its values', async () => {
    serve(proWith());
    await renderRecap();
    await screen.findByTestId('recap-card-rhythm');
    expect(readable('recap-card-rhythm')).toContain('Sunday mornings');
    expect(readable('recap-card-rhythm')).toContain('9 rides started between 05 and 12');
    expect(readable('recap-card-new-roads')).toContain('84%');
    expect(readable('recap-card-new-roads')).toContain('343 km²');
    expect(readable('recap-card-twistiest')).toContain('Saturday Evening Ride');
    // Rounded as everywhere else: whole km, bends to one decimal as on the detail page.
    expect(readable('recap-card-twistiest')).toContain('52 km');
    expect(readable('recap-card-twistiest')).toContain('21.3 bends every 10 km');
  });

  it('with EUR and USD spend sees EUR first, USD listed beneath, and which distance it used', async () => {
    serve(proWith());
    await renderRecap();
    await screen.findByTestId('recap-card-cost');
    const cost = readable('recap-card-cost');
    expect(cost).toContain('€0.14/km');
    expect(cost).toContain('Also $0.03/km');
    expect(cost.indexOf('€0.14/km')).toBeLessThan(cost.indexOf('$0.03/km'));
    expect(cost).toContain('Divided by the odometer change across the season');
  });

  it('with no fuel or service expenses sees the cost card ask for fuel, with no figure', async () => {
    serve(proWith({ costPerKm: { status: RiderInsightsStatus.MissingInput, items: null } }));
    await renderRecap();
    await screen.findByTestId('recap-card-cost');
    expect(readable('recap-card-cost')).toContain('Needs fuel logged across the season');
    expect(readable('recap-card-cost')).not.toMatch(/\d/);
  });

  it('shares the card in view as a story image naming MotoVault', async () => {
    mockCapture.mockResolvedValue('file:///recap-distance.png');
    mockShareOpen.mockResolvedValue({ success: true });
    serve(proWith());
    await renderRecap();
    await screen.findByTestId('recap-card-distance');
    await act(async () => {
      fireEvent.press(screen.getByTestId('recap-share'));
    });
    await waitFor(() => expect(mockShareOpen).toHaveBeenCalledTimes(1));
    expect(mockCapture.mock.calls[0][2]).toEqual({ width: 1080, height: 1920 });
    expect(mockShareOpen.mock.calls[0][0]).toMatchObject({
      url: 'file:///recap-distance.png',
      message: expect.stringContaining('MotoVault'),
    });
  });
});

describe('sharing a card that draws a ride shape', () => {
  /** Scrolls the recap to the Longest ride card, the third (still a free one). */
  async function showLongest() {
    const width = recapCardWidth({
      windowWidth: 390,
      windowHeight: 844,
      fontScale: 1,
      topInset: 54,
      bottomClearance: 120,
    });
    await fireEvent(screen.getByTestId('recap-cards'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 2 * (width + space.sm), y: 0 } },
    });
  }

  let alert: jest.SpyInstance;
  beforeEach(() => {
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    alert.mockRestore();
    jest.useRealTimers();
  });

  it('without the ride, shows the share error and captures nothing', async () => {
    mockFetcher.mockImplementation((document: unknown) =>
      document === GetRiderInsightsDocument
        ? Promise.resolve({ riderInsights: payload })
        : Promise.reject(new Error('offline')),
    );
    serve(proWith());
    await renderRecap();
    await screen.findByTestId('recap-card-longest');
    await showLongest();

    await act(async () => {
      fireEvent.press(screen.getByTestId('recap-share'));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'Something went wrong. Please try again.'),
    );
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockShareOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('recap-share').props.accessibilityState.busy).toBe(false);
  });

  it('gives up after a bounded wait when the ride never loads', async () => {
    mockFetcher.mockImplementation((document: unknown) =>
      document === GetRiderInsightsDocument
        ? Promise.resolve({ riderInsights: payload })
        : new Promise(() => {}),
    );
    serve(proWith());
    await renderRecap();
    await screen.findByTestId('recap-card-longest');
    await showLongest();

    jest.useFakeTimers();
    await act(async () => {
      fireEvent.press(screen.getByTestId('recap-share'));
    });
    expect(screen.getByTestId('recap-share').props.accessibilityState.busy).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(EXPORT_READY_TIMEOUT_MS);
    });

    expect(alert).toHaveBeenCalledWith('Error', 'Something went wrong. Please try again.');
    expect(mockCapture).not.toHaveBeenCalled();
    expect(screen.getByTestId('recap-share').props.accessibilityState.busy).toBe(false);
  });
});

describe('the season shown', () => {
  it('before the fifth qualifying ride of a new year, is the previous season', async () => {
    // The API keeps last season until the new one has five qualifying rides;
    // today's date is in the season after.
    serve(freeInsights({ season: { from: '2025-01-01', to: '2025-12-31' } }));
    await renderRecap();
    await screen.findByTestId('recap-card-distance');
    expect(screen.getByText('Your 2025 season')).toBeTruthy();
    expect(readable('recap-card-distance')).toContain('36 rides in 2025');
  });
});

describe('the entry on Rider insights', () => {
  it('names the season and opens the recap', async () => {
    serve(freeInsights({ season: { from: '2025-01-01', to: '2025-12-31' } }));
    await render(
      <QueryClientProvider client={client}>
        <RiderInsightsScreen />
      </QueryClientProvider>,
    );
    const entry = await screen.findByTestId('insights-recap-entry');
    expect(within(entry).getByText('Your 2025 season recap')).toBeTruthy();
    expect(within(entry).getByText('3 cards to keep or post · 4 more with Pro')).toBeTruthy();
    fireEvent.press(entry);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: PROFILE_ROUTE.RIDER_INSIGHTS_RECAP,
    });
  });
});

describe('recapCardWidth', () => {
  const phone = { windowWidth: 402, windowHeight: 874, fontScale: 1, topInset: 62 };

  it('keeps the share button above the tab bar on a tall phone', () => {
    const width = recapCardWidth({ ...phone, bottomClearance: 130 });
    // Card plus everything around it fits in the window.
    expect(62 + 44 + 12 + 78 + 48 + 8 + 52 + 130 + width * RECAP_ASPECT).toBeLessThanOrEqual(874);
    expect(width).toBeLessThan(402 * 0.7);
  });

  it('uses the width share when the screen is tall enough', () => {
    expect(recapCardWidth({ ...phone, windowHeight: 1_400, bottomClearance: 130 })).toBeCloseTo(
      402 * 0.7,
    );
  });

  it('never shrinks a card below its readable minimum', () => {
    expect(recapCardWidth({ ...phone, windowHeight: 500, bottomClearance: 130 })).toBe(200);
  });
});
