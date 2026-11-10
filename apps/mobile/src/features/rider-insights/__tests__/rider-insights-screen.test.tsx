// The Rider insights screen: what each row shows by status, the locked-row
// paywall and its events, the offline states, the region swap and the unlock
// after a purchase.
import type { ReactNode } from 'react';

jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.28.0' }));
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
let mockParams: Record<string, string> = {};
let mockSegments: string[] = ['(tabs)', '(profile)', 'rider-insights'];
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useSegments: () => mockSegments,
  Stack: { Screen: () => null },
}));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

const mockOpenBrowser = jest.fn();
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowser(...args),
}));

const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentRiderInsightsPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));

const mockCaptureRef = jest.fn();
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
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

const mockLineLayers: Record<string, unknown>[] = [];
const mockCameras: Record<string, unknown>[] = [];
const mockShapes: Record<string, unknown>[] = [];
jest.mock('@rnmapbox/maps', () => {
  const { View } = require('react-native');
  const Pass = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return {
    __esModule: true,
    default: {
      MapView: Pass,
      Camera: (props: Record<string, unknown>) => {
        mockCameras.push(props);
        return null;
      },
      ShapeSource: (props: Record<string, unknown> & { children?: ReactNode }) => {
        mockShapes.push(props);
        return <View>{props.children}</View>;
      },
      LineLayer: (props: Record<string, unknown>) => {
        mockLineLayers.push(props);
        return null;
      },
    },
  };
});

import { GetRiderInsightsDocument } from '@motovault/graphql';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';
import '@/i18n';
import { HOME_ROUTE, PROFILE_ROUTE, RIDER_INSIGHTS_ENTRY } from '@/config/routes';
import { WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import {
  computingInsights,
  freeInsights,
  type InsightsPayload,
  newRiderInsights,
  proInsights,
} from '@/test/rider-insights-fixtures';
import { clearBlurCaptures } from '../blur-capture';
import { RiderInsightsScreen } from '../rider-insights-screen';
import { deviceTimeZone } from '../use-rider-insights';

const mockDimensions = useWindowDimensions as jest.Mock;
const mockTrack = trackEvent as jest.Mock;
const LOCKED_ROWS = ['road-character-row', 'territory-row', 'rhythm-row'];

let client: QueryClient;

function respond(...payloads: InsightsPayload[]) {
  for (const payload of payloads) {
    mockFetcher.mockResolvedValueOnce({ riderInsights: payload });
  }
}

async function renderScreen() {
  return await render(
    <QueryClientProvider client={client}>
      <RiderInsightsScreen />
    </QueryClientProvider>,
  );
}

/** Every text in a subtree plus every accessibility label, as one string. */
function readable(testID: string): string {
  const node = screen.getByTestId(testID);
  const texts = within(node)
    .queryAllByText(/.*/)
    .map((n) => n.props.children);
  return [node.props.accessibilityLabel, ...texts].join(' ');
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockPresentPaywall.mockReset();
  mockCaptureRef.mockReset();
  mockCaptureRef.mockReturnValue(new Promise(() => {}));
  mockRouter.push.mockReset();
  mockTrack.mockReset();
  mockLineLayers.length = 0;
  mockCameras.length = 0;
  mockShapes.length = 0;
  mockParams = {};
  mockSegments = ['(tabs)', '(profile)', 'rider-insights'];
  mockDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  clearBlurCaptures();
  onlineManager.setOnline(true);
  useSubscriptionStore.setState({ isPro: false });
  useAuthStore.setState({ measurementSystem: 'metric' });
});

describe('place-name attribution', () => {
  it('credits GeoNames under the list and opens its site', async () => {
    respond(freeInsights());
    await renderScreen();
    const credit = await screen.findByTestId('insights-geonames-credit');
    expect(credit.props.accessibilityRole).toBe('link');
    expect(within(credit).getByText('Place names: GeoNames (CC BY 4.0)')).toBeTruthy();
    await fireEvent.press(credit);
    expect(mockOpenBrowser).toHaveBeenCalledWith('https://www.geonames.org/');
  });
});

describe('a free rider with 20 qualifying rides', () => {
  it('sees Territory locked with Unlock, and no value anywhere a screen reader can reach', async () => {
    respond(freeInsights());
    await renderScreen();
    const row = await screen.findByTestId('territory-row');
    expect(row.props.accessibilityLabel).toBe('Territory, Pro. Opens the paywall');
    expect(within(row).getByText('Unlock')).toBeTruthy();
    // The rounded headline (340 km²) is the paywall's to quote, never the row's.
    expect(readable('territory-row')).not.toMatch(/\d/);
  });

  it('keeps every locked graphic behind the placeholder until its capture exists', async () => {
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('road-character-row');
    for (const id of LOCKED_ROWS) {
      const row = screen.getByTestId(id);
      expect(
        within(row).getByTestId('blur-capture-placeholder', { includeHiddenElements: true }),
      ).toBeTruthy();
      expect(
        within(row).queryByTestId('blur-capture-image', { includeHiddenElements: true }),
      ).toBeNull();
    }
  });

  it('swaps the placeholder for the blurred capture once it is taken', async () => {
    mockCaptureRef.mockResolvedValue('file:///capture.png');
    respond(freeInsights());
    await renderScreen();
    const row = await screen.findByTestId('road-character-row');
    await act(async () => {
      fireEvent(
        within(row).getByTestId('blur-capture-source', { includeHiddenElements: true }),
        'layout',
      );
    });
    const image = await within(screen.getByTestId('road-character-row')).findByTestId(
      'blur-capture-image',
      { includeHiddenElements: true },
    );
    expect(image.props.blurRadius).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('road-character-row')).queryByTestId('blur-capture-source', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
  });

  it('reports each locked row as shown once per visit, naming the row', async () => {
    respond(freeInsights());
    const { rerender } = await renderScreen();
    await screen.findByTestId('rhythm-row');
    await rerender(
      <QueryClientProvider client={client}>
        <RiderInsightsScreen />
      </QueryClientProvider>,
    );
    const shown = mockTrack.mock.calls.filter(
      ([event]) => event === AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_SHOWN,
    );
    expect(shown.map(([, props]) => props.row).sort()).toEqual([
      'rhythm',
      'road_character',
      'territory',
    ]);
  });

  it('presents the paywall with a road-character headline on Unlock, after a tap event naming the row', async () => {
    mockPresentPaywall.mockResolvedValue('cancelled');
    respond(freeInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('road-character-row'));
    await waitFor(() => expect(mockPresentPaywall).toHaveBeenCalledTimes(1));
    expect(mockTrack).toHaveBeenCalledWith(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, {
      row: 'road_character',
    });
    const [row, copy] = mockPresentPaywall.mock.calls[0];
    expect(row).toBe('road_character');
    expect(copy.headline).toBe('2,507 km this season');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('unlocks the rows after a purchase, by refetching with an entitlement refresh', async () => {
    mockPresentPaywall.mockResolvedValue('purchased');
    respond(freeInsights(), proInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('territory-row'));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('territory-row')).getByText('343 km² · 84% new roads'),
      ).toBeTruthy(),
    );
    expect(mockFetcher).toHaveBeenLastCalledWith(GetRiderInsightsDocument, {
      timeZone: deviceTimeZone(),
      refreshEntitlement: true,
    });
    expect(screen.queryByText('Unlock')).toBeNull();
  });

  it('shows the locked rows as unlocking, with no paywall, while the server still reads free after a purchase', async () => {
    mockPresentPaywall.mockResolvedValue('purchased');
    respond(freeInsights(), freeInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('rhythm-row'));
    await act(async () => useSubscriptionStore.setState({ isPro: true }));
    await waitFor(() => expect(screen.getAllByText('Unlocking…')).toHaveLength(3));
    await fireEvent.press(screen.getByTestId('territory-row'));
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
  });

  it('shows the free longest ride under Best ride and opens its page', async () => {
    respond(freeInsights());
    await renderScreen();
    const row = await screen.findByTestId('best-rides-row');
    expect(within(row).getByText('Weekend Tatras Tour · 385 km')).toBeTruthy();
    await fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(profile)/rider-insights/[group]',
      params: { group: 'best-rides' },
    });
  });
});

describe('a rider with 4 qualifying rides', () => {
  it('sees the keep-riding text on every Pro row, and a tap opens no paywall', async () => {
    respond(newRiderInsights());
    await renderScreen();
    await screen.findByTestId('territory-row');
    for (const id of [...LOCKED_ROWS, 'best-rides-row']) {
      expect(
        within(screen.getByTestId(id)).getByText('Not enough rides yet, keep riding'),
      ).toBeTruthy();
      await fireEvent.press(screen.getByTestId(id));
    }
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('blur-capture-placeholder', { includeHiddenElements: true }),
    ).toBeNull();
  });
});

describe('the first open after the update', () => {
  it('shows the free totals and computing rows with no number', async () => {
    respond(computingInsights());
    await renderScreen();
    expect(await screen.findByText('2,507')).toBeTruthy();
    for (const id of [...LOCKED_ROWS, 'best-rides-row']) {
      const text = readable(id);
      expect(text).toContain('Working out your rides');
      expect(text).not.toMatch(/\d/);
    }
  });
});

describe('offline', () => {
  it('shows the offline state, not zeros, on a cold start with no saved copy', async () => {
    onlineManager.setOnline(false);
    respond(freeInsights());
    await renderScreen();
    expect(await screen.findByTestId('insights-offline')).toBeTruthy();
    expect(screen.queryByText(/^0/)).toBeNull();
  });

  it('shows a saved copy with a stale marker, and the map waits for a request', async () => {
    const saved = freeInsights();
    client.setQueryData(queryKeys.rides.insights(deviceTimeZone()), {
      riderInsights: { ...saved, regions: saved.regions.map((r) => ({ ...r, routes: [] })) },
    });
    onlineManager.setOnline(false);
    await renderScreen();
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(await screen.findByTestId('insights-stale')).toBeTruthy();
    expect(screen.getByText('2,507')).toBeTruthy();
    expect(screen.getByTestId('hero-map-placeholder')).toBeTruthy();
    expect(screen.getByText("The map shows when you're back online.")).toBeTruthy();
  });

  it('shows the error state when the request fails online', async () => {
    mockFetcher.mockRejectedValueOnce(new Error('500'));
    await renderScreen();
    expect(await screen.findByTestId('insights-error')).toBeTruthy();
  });
});

describe('the map', () => {
  it('swaps the main region with a tapped tile, without navigating', async () => {
    respond(freeInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('region-tile-SK.02'));
    expect(screen.getByTestId('hero-map').props.accessibilityLabel).toBe(
      'Map of 9 rides around Bratislava',
    );
    expect(screen.getByTestId('region-tile-ES.27')).toBeTruthy();
    expect(screen.queryByTestId('region-tile-SK.02')).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('draws the routes beneath the place labels', async () => {
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('hero-map');
    expect(mockLineLayers.length).toBeGreaterThan(0);
    for (const layer of mockLineLayers) expect(layer.belowLayerID).toBe('road-label-simple');
  });

  it('labels the country ovals with every country name', async () => {
    respond(freeInsights());
    await renderScreen();
    const ovals = await screen.findByTestId('country-ovals');
    expect(ovals.props.accessibilityLabel).toBe('2 countries: Spain, Slovakia. Open countries');
    expect(within(ovals).getByText('E')).toBeTruthy();
    expect(within(ovals).getByText('SK')).toBeTruthy();
  });
});

describe('the full-screen map', () => {
  it("opens from a tap on the hero, with every region's routes, framed on the region shown", async () => {
    respond(freeInsights());
    await renderScreen();
    const hero = await screen.findByTestId('hero-map');
    expect(hero.props.accessibilityRole).toBe('button');
    expect(hero.props.accessibilityHint).toBe('Opens the map full screen');
    expect(screen.getByTestId('hero-map-expand', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('atlas-full-map')).toBeNull();

    // Bratislava on the hero first: the full map must open on it, not on the API's first region.
    await fireEvent.press(screen.getByTestId('region-tile-SK.02'));
    await fireEvent.press(screen.getByTestId('hero-map'));
    expect(screen.getByTestId('atlas-full-map')).toBeTruthy();

    const shape = mockShapes.filter((s) => s.id === 'insights-full-routes').at(-1)?.shape as {
      features: unknown[];
    };
    expect(shape.features).toHaveLength(2);
    const camera = mockCameras.at(-1)?.defaultSettings as { centerCoordinate: number[] };
    const [lng, lat] = camera.centerCoordinate;
    expect(lng).toBeCloseTo(18.6, 1);
    expect(lat).toBeGreaterThan(48);
    const fullLayers = mockLineLayers.filter((l) => String(l.id).startsWith('insights-full-'));
    expect(fullLayers.map((l) => l.id)).toEqual(
      expect.arrayContaining(['insights-full-routes-glow', 'insights-full-routes-line']),
    );
    for (const layer of fullLayers) expect(layer.belowLayerID).toBe('road-label-simple');
  });

  it('closes from its close button', async () => {
    respond(freeInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('hero-map'));
    const close = screen.getByTestId('atlas-full-map-close');
    expect(close.props.accessibilityLabel).toBe('Close map');
    await fireEvent.press(close);
    expect(screen.queryByTestId('atlas-full-map')).toBeNull();
  });
});

describe('the other regions', () => {
  it('say what they are above the tiles', async () => {
    respond(freeInsights());
    await renderScreen();
    const tiles = await screen.findByTestId('region-tiles');
    expect(within(tiles).getByText('Other places you rode')).toBeTruthy();
    expect(within(tiles).getByText('Tap one to show it on the map above.')).toBeTruthy();
  });
});

describe('the season ribbon', () => {
  it('opens the season page from a tap anywhere on the card', async () => {
    respond(freeInsights());
    await renderScreen();
    const ribbon = await screen.findByTestId('season-ribbon');
    expect(ribbon.props.accessibilityRole).toBe('button');
    expect(ribbon.props.accessibilityLabel).toBe(
      '2 of 46 weeks ridden. Biggest: 385 km, Mar 2 to 8',
    );
    await fireEvent.press(ribbon);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: PROFILE_ROUTE.RIDER_INSIGHTS_DETAIL,
      params: { group: 'season' },
    });
  });
});

describe('one scroll view', () => {
  // The iOS large title binds to the first scroll view; a swap leaves it drawn under the header.
  it('keeps the same scroll view from loading to loaded', async () => {
    // Held until the loading state is checked: an instant response could land
    // first under a loaded test run and skip the loading state entirely.
    let release: (value: { riderInsights: InsightsPayload }) => void = () => undefined;
    mockFetcher.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await renderScreen();
    const loading = screen.getByTestId('insights-scroll');
    expect(screen.getByTestId('insights-loading')).toBeTruthy();
    await act(async () => {
      release({ riderInsights: freeInsights() });
    });
    await screen.findByTestId('territory-row');
    expect(screen.getByTestId('insights-scroll')).toBe(loading);
  });

  it('keeps the same scroll view from an error to the retried load', async () => {
    mockFetcher.mockRejectedValueOnce(new Error('500'));
    await renderScreen();
    await fireEvent.press(await screen.findByText('Try again'));
    const failed = screen.getByTestId('insights-scroll');
    respond(freeInsights());
    await act(async () => {
      await client.refetchQueries();
    });
    await screen.findByTestId('territory-row');
    expect(screen.getByTestId('insights-scroll')).toBe(failed);
  });
});

describe('navigation stays in the tab stack it was opened in', () => {
  it("opens a detail page on Profile's stack", async () => {
    respond(freeInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('best-rides-row'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: PROFILE_ROUTE.RIDER_INSIGHTS_DETAIL }),
    );
  });

  it("opens a detail page and the recap on Home's stack when opened from Home", async () => {
    mockSegments = ['(tabs)', '(home)', 'home', 'rider-insights'];
    respond(freeInsights());
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('best-rides-row'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: HOME_ROUTE.RIDER_INSIGHTS_DETAIL }),
    );
    await fireEvent.press(screen.getByTestId('insights-recap-entry'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: HOME_ROUTE.RIDER_INSIGHTS_RECAP });
  });
});

describe('entry', () => {
  it.each(
    Object.values(RIDER_INSIGHTS_ENTRY),
  )('emits one open event for entry %s', async (entry) => {
    mockParams = { entry };
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('territory-row');
    const opened = mockTrack.mock.calls.filter(
      ([event]) => event === AnalyticsEvent.RIDER_INSIGHTS_OPENED,
    );
    expect(opened).toEqual([[AnalyticsEvent.RIDER_INSIGHTS_OPENED, { entry }]]);
  });
});

describe('at AX5', () => {
  it('stacks each row, so a long value wraps instead of being cut', async () => {
    mockDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 3.1 });
    respond(proInsights());
    await renderScreen();
    const row = await screen.findByTestId('bikes-row');
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
    const value = within(row).getByText('R 1250 GS 1,144 km · Africa Twin 1,118 km');
    expect(value.props.numberOfLines).toBeUndefined();
  });
});

describe('the NEW chip', () => {
  beforeEach(() => {
    useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
  });

  it('opening from Profile counts as using Road Atlas', async () => {
    mockParams = { entry: RIDER_INSIGHTS_ENTRY.PROFILE };
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('territory-row');
    expect(useWhatsNewStore.getState().usedFeatures).toContain(WHATS_NEW_FEATURE.ROAD_ATLAS);
  });

  it("opening from a What's New page does not", async () => {
    mockParams = { entry: RIDER_INSIGHTS_ENTRY.WHATS_NEW };
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('territory-row');
    expect(useWhatsNewStore.getState().usedFeatures).not.toContain(WHATS_NEW_FEATURE.ROAD_ATLAS);
  });
});

describe("the way back to What's New", () => {
  const BACK = "Back to What's New";

  beforeEach(() => {
    useWhatsNewStore.setState({ returnSessionOpen: true });
  });
  afterEach(() => {
    useWhatsNewStore.setState({ returnSessionOpen: false });
  });

  it('opened from a What’s New page: the bar floats above the tab bar', async () => {
    mockParams = { entry: RIDER_INSIGHTS_ENTRY.WHATS_NEW, wnPage: '0' };
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('territory-row');
    expect(screen.getByRole('button', { name: BACK })).toBeOnTheScreen();
    // The mocked clearance is the tab bar's height plus its offset.
    expect(StyleSheet.flatten(screen.getByTestId('insights-whats-new-return').props.style)).toEqual(
      expect.objectContaining({ position: 'absolute', bottom: 120 }),
    );
  });

  it('opened from Profile: no bar', async () => {
    mockParams = { entry: RIDER_INSIGHTS_ENTRY.PROFILE };
    respond(freeInsights());
    await renderScreen();
    await screen.findByTestId('territory-row');
    expect(screen.queryByRole('button', { name: BACK })).toBeNull();
  });
});
