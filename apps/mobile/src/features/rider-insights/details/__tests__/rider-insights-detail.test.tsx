// Rider insights detail pages: what each group's page shows for a Pro rider,
// the locked template a free rider gets (deep links included), Best rides'
// free view, lean shown only in bands, and the one summary label per graphic.
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
let mockSegments: string[] = ['(tabs)', '(profile)', 'rider-insights', '[group]'];
let mockParams: Record<string, string> = {};
const mockScreenOptions: Record<string, unknown>[] = [];
const mockRedirects: unknown[] = [];
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
  useSegments: () => mockSegments,
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => {
      mockScreenOptions.push(options);
      return null;
    },
  },
  Redirect: ({ href }: { href: unknown }) => {
    mockRedirects.push(href);
    return null;
  },
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
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: { testID?: string }) => <View testID={props.testID} /> };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Box, Svg: Box, Path: () => null };
});

// The native segmented control, as one pressable per segment.
jest.mock('@/components/ui/themed-segmented-control', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ThemedSegmentedControl: ({
      values,
      onChange,
    }: {
      values: string[];
      onChange: (index: number) => void;
    }) =>
      values.map((label, index) => (
        <Pressable key={label} testID={`segment-${index}`} onPress={() => onChange(index)}>
          <Text>{label}</Text>
        </Pressable>
      )),
  };
});

import { RiderInsightsStatus } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import '@/i18n';
import RiderInsightsDetailRoute from '@/app/(tabs)/(profile)/rider-insights/[group]';
import { HOME_ROUTE, PROFILE_ROUTE } from '@/config/routes';
import { useAuthStore } from '@/stores/auth.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import {
  freeInsights,
  type InsightsPayload,
  newRiderInsights,
  proInsights,
} from '@/test/rider-insights-fixtures';
import { clearBlurCaptures } from '../../blur-capture';

const RIDE = {
  EZCARAY: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d01',
  PYRENEES: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d02',
  EBRO: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d03',
  CLIMB: '0a6f2a52-7c0e-4b5e-9a51-1f6d2b3c4d04',
} as const;

const bestRide = (
  rideId: string,
  name: string,
  localDate: string,
  distanceM: number,
  bends: number,
) => ({
  rideId,
  name,
  localDate,
  distanceM,
  climbM: 1_311,
  bendsPer10km: bends,
  movingTimeS: 4_919,
});

/** The Pro rider, with ranked rides and the road-character coverage of the test account (13 routed, 9 with waypoints). */
function proDetail(): InsightsPayload {
  const pro = proInsights();
  const rc = pro.roadCharacter.detail;
  const br = pro.bestRides.detail;
  if (!rc || !br) throw new Error('fixture: Pro groups must be ready');
  return {
    ...pro,
    roadCharacter: {
      ...pro.roadCharacter,
      detail: {
        ...rc,
        ridesWithBands: 13,
        ridesWithLean: 9,
        twistiest: [
          {
            rideId: RIDE.EZCARAY,
            name: 'Ezcaray climbs',
            localDate: '2026-10-10',
            distanceM: 71_000,
            bendsPer10km: 21.3,
          },
        ],
        straightest: [
          {
            rideId: RIDE.EBRO,
            name: 'Ebro valley',
            localDate: '2026-11-08',
            distanceM: 48_000,
            bendsPer10km: 2.3,
          },
          {
            rideId: RIDE.CLIMB,
            name: 'Sierra climb',
            localDate: '2026-09-12',
            distanceM: 140_000,
            bendsPer10km: 2.9,
          },
        ],
      },
    },
    bestRides: {
      ...pro.bestRides,
      detail: {
        ...br,
        byDistance: [
          bestRide(RIDE.PYRENEES, 'Pyrenees loop', '2026-07-04', 312_000, 15.5),
          bestRide(RIDE.EZCARAY, 'Ezcaray climbs', '2026-10-10', 71_000, 21.3),
        ],
        byClimb: [bestRide(RIDE.CLIMB, 'Sierra climb', '2026-09-12', 140_000, 8.8)],
        // The API ranks; the 10 Oct ride has the most bends per 10 km.
        byBends: [
          bestRide(RIDE.EZCARAY, 'Ezcaray climbs', '2026-10-10', 71_000, 21.3),
          bestRide(RIDE.PYRENEES, 'Pyrenees loop', '2026-07-04', 312_000, 15.5),
        ],
      },
    },
  };
}

let client: QueryClient;

async function openDetail(group: string, payload: InsightsPayload) {
  mockParams = { group };
  mockFetcher.mockResolvedValueOnce({ riderInsights: payload });
  await render(
    <QueryClientProvider client={client}>
      <RiderInsightsDetailRoute />
    </QueryClientProvider>,
  );
  await screen.findByTestId(`rider-insights-detail-${group}`);
  await waitFor(() => expect(screen.queryByTestId('detail-loading')).toBeNull());
}

/** Every text under a node, flattened. */
function textsIn(testID: string): string[] {
  return within(screen.getByTestId(testID))
    .queryAllByText(/.*/, { includeHiddenElements: true })
    .map((n) => [n.props.children].flat().join(''));
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockFetcher.mockReset();
  mockPresentPaywall.mockReset();
  mockPresentPaywall.mockResolvedValue('cancelled');
  mockRouter.push.mockReset();
  mockScreenOptions.length = 0;
  mockRedirects.length = 0;
  mockSegments = ['(tabs)', '(profile)', 'rider-insights', '[group]'];
  mockParams = {};
  clearBlurCaptures();
  useSubscriptionStore.setState({ isPro: false });
  useAuthStore.setState({ measurementSystem: 'metric' });
});

describe('road character, Pro', () => {
  it('titles the native header with the group', async () => {
    await openDetail('road-character', proDetail());
    expect(mockScreenOptions.at(-1)).toEqual({ title: 'Road character' });
  });

  it('groups the season bend count in the footnote', async () => {
    await openDetail('road-character', proDetail());
    expect(screen.getByText(/5,000 bends this season\./)).toBeTruthy();
  });

  it('says lean comes from 9 of 13 rides when 4 routed rides have no waypoints', async () => {
    await openDetail('road-character', proDetail());
    expect(await screen.findByTestId('lean-coverage')).toHaveTextContent('From 9 of 13 rides');
  });

  it('shows lean only as four band shares, never one degree value', async () => {
    await openDetail('road-character', proDetail());
    const lean = await screen.findByTestId('lean-bands');
    const degreeTexts = textsIn('lean-bands').filter((text) => text.includes('°'));
    expect(degreeTexts).toEqual(['<20°', '20–30°', '30–40°', '40°+']);
    expect(textsIn('lean-bands')).toEqual(expect.arrayContaining(['60%', '30%', '8%', '2%']));
    expect(lean.props.accessibilityLabel).toBe(
      'Share of corners by lean: under 20° 60%, 20 to 30° 30%, 30 to 40° 8%, 40° and over 2%',
    );
    // The hero is the twisty share, not a lean figure.
    expect(screen.getByTestId('detail-hero').props.accessibilityLabel).not.toMatch(/°/);
  });

  it('labels the band bar with each band’s km and share, not colour alone', async () => {
    await openDetail('road-character', proDetail());
    expect(screen.getByTestId('road-character-bar').props.accessibilityLabel).toBe(
      'Straight 1,325 km, 55%, sweeping 456 km, 19%, twisty 314 km, 13%, tight bends 305 km, 13%',
    );
    expect(screen.getByTestId('detail-hero').props.accessibilityLabel).toBe(
      '26% of your 2,400 km routed were twisty or tighter',
    );
  });

  it('opens a ranked ride from the twistiest list', async () => {
    await openDetail('road-character', proDetail());
    await fireEvent.press(screen.getByTestId(`ride-${RIDE.EZCARAY}`));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(modals)/ride-detail',
      params: { rideId: RIDE.EZCARAY, source: 'rider_insights' },
    });
  });
});

describe('rhythm and territory, Pro', () => {
  it('labels the rhythm grid with the busiest slot', async () => {
    await openDetail('rhythm', proDetail());
    expect(screen.getByTestId('rhythm-grid').props.accessibilityLabel).toBe(
      'Busiest slot Sunday mornings',
    );
    expect(screen.getByTestId('detail-hero').props.accessibilityLabel).toBe(
      '58% 18 of 31 rides at the weekend',
    );
  });

  it('labels the new-roads bar with both shares', async () => {
    await openDetail('territory', proDetail());
    expect(screen.getByTestId('territory-new-roads-bar').props.accessibilityLabel).toBe(
      "84% of this season's distance on new roads, 16% on roads ridden before",
    );
    expect(screen.getByTestId('detail-hero').props.accessibilityLabel).toBe(
      '343 km² of map covered this season',
    );
  });

  it('names the furthest ride', async () => {
    await openDetail('territory', proDetail());
    expect(screen.getByTestId('territory-furthest')).toHaveTextContent(/Tatra loop/);
  });

  it('names an unnamed furthest ride by its date', async () => {
    const unnamed = proDetail();
    const detail = unnamed.territory.detail;
    if (!detail?.furthest) throw new Error('fixture: territory must be ready');
    await openDetail('territory', {
      ...unnamed,
      territory: {
        ...unnamed.territory,
        detail: { ...detail, furthest: { ...detail.furthest, name: null } },
      },
    });
    expect(screen.getByTestId('territory-furthest')).toHaveTextContent(/Ride on Mar 8/);
  });
});

describe('road character lists', () => {
  it('shows one straightest ride, as the board does', async () => {
    await openDetail('road-character', proDetail());
    expect(screen.getByText('Straightest ride')).toBeTruthy();
    expect(screen.getByTestId(`ride-${RIDE.EBRO}`)).toBeTruthy();
    expect(screen.queryByTestId(`ride-${RIDE.CLIMB}`)).toBeNull();
  });
});

describe('best rides', () => {
  it('names an unnamed ride by its date once, and keeps its duration on one line', async () => {
    const payload = proDetail();
    const br = payload.bestRides.detail;
    if (!br) throw new Error('fixture: best rides must be ready');
    await openDetail('best-rides', {
      ...payload,
      bestRides: {
        ...payload.bestRides,
        detail: {
          ...br,
          byDistance: [{ ...bestRide(RIDE.PYRENEES, '', '2026-10-03', 64_000, 9), name: null }],
        },
      },
    });
    const label = screen.getByTestId('best-ride-0').props.accessibilityLabel as string;
    expect(label).toMatch(/^Ride on Oct 3, /);
    expect(label.match(/Oct 3/g)).toHaveLength(1);
    expect(label).toContain('1h\u00A021m');
  });

  it('lists the 10 Oct ride first when ranked by bends', async () => {
    await openDetail('best-rides', proDetail());
    expect(screen.getByTestId('best-ride-0').props.accessibilityLabel).toMatch(/^Pyrenees loop/);
    await fireEvent.press(screen.getByTestId('segment-2'));
    const first = screen.getByTestId('best-ride-0');
    expect(first.props.accessibilityLabel).toMatch(/^Ezcaray climbs, Oct 10/);
    expect(first.props.accessibilityLabel).toMatch(/21\.3 bends \/ 10 km$/);
    expect(mockPresentPaywall).not.toHaveBeenCalled();
  });

  it('gives a free rider the longest ride in full, and the paywall from climb or bends', async () => {
    await openDetail('best-rides', freeInsights());
    expect(screen.getByTestId('best-ride-longest').props.accessibilityLabel).toBe(
      'Weekend Tatras Tour, Mar 8 · Bratislava to Bratislava · 6h\u00A00m, 385 km',
    );
    await fireEvent.press(screen.getByTestId('segment-0'));
    expect(mockPresentPaywall).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('segment-1'));
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    expect(mockPresentPaywall).toHaveBeenCalledWith('best_rides', {
      headline: 'Your longest ride: 385 km',
      subhead: 'Pro ranks your season by distance, climb and bends.',
    });
    // No ranking reaches a free rider: only the longest ride is listed.
    expect(screen.queryByTestId('best-ride-0')).toBeNull();
  });
});

describe('bikes', () => {
  it('shows both bikes with distance, rides and moving time, and the bikeless ride under Unassigned', async () => {
    await openDetail('bikes', freeInsights());
    expect(screen.getByTestId('bike-bike-gs').props.accessibilityLabel).toBe(
      'R 1250 GS, 18 rides · 20h 0m moving, 1,144 km',
    );
    expect(screen.getByTestId('bike-bike-at').props.accessibilityLabel).toBe(
      'Africa Twin, 17 rides · 19h 26m moving, 1,118 km',
    );
    expect(screen.getByTestId('bike-unassigned').props.accessibilityLabel).toBe(
      'Unassigned, 1 ride · 2h 30m moving, 245 km',
    );
  });
});

describe('countries', () => {
  it('lists each country with its first date and distance', async () => {
    await openDetail('countries', freeInsights());
    expect(screen.getByTestId('country-SK').props.accessibilityLabel).toBe(
      'Slovakia, First ridden Jan 10 · 14 rides, 907 km',
    );
    expect(screen.getByTestId('country-ES').props.accessibilityLabel).toBe(
      'Spain, First ridden Apr 1 · 22 rides, 1,600 km',
    );
  });
});

describe('a free rider on a Pro page', () => {
  it('gets the locked template from a deep link: rounded headline, blurred teaser, one Unlock', async () => {
    await openDetail('territory', freeInsights());
    expect(screen.getByTestId('detail-locked')).toBeTruthy();
    expect(mockScreenOptions.at(-1)).toEqual({ title: 'Territory' });
    expect(screen.getByTestId('detail-hero').props.accessibilityLabel).toBe(
      '340 km² of map covered this season, rounded',
    );
    expect(
      screen.getByTestId('blur-capture-placeholder', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getAllByTestId('detail-unlock')).toHaveLength(1);
    expect(screen.queryByTestId('territory-new-roads-bar')).toBeNull();

    await fireEvent.press(screen.getByTestId('detail-unlock'));
    expect(mockPresentPaywall).toHaveBeenCalledWith('territory', {
      headline: '2,507 km this season',
      subhead: 'Pro shows how much of it was new road, and how far from home you went.',
    });
  });

  it('reads the keep-riding line below five qualifying rides, with no Unlock', async () => {
    await openDetail('road-character', newRiderInsights());
    expect(screen.getByTestId('detail-not_enough')).toHaveTextContent(
      'Not enough rides yet, keep riding',
    );
    expect(screen.queryByTestId('detail-unlock')).toBeNull();
  });

  it('names what is missing instead of a number', async () => {
    await openDetail('rhythm', {
      ...proDetail(),
      rhythm: {
        status: RiderInsightsStatus.MissingInput,
        headline: null,
        teaser: null,
        detail: null,
      },
    });
    expect(screen.getByTestId('detail-missing_input')).toHaveTextContent(
      'Needs rides with a start time',
    );
  });
});

it('sends an unknown group to the main Rider insights screen', async () => {
  mockParams = { group: 'lean-leaderboard' };
  await render(
    <QueryClientProvider client={client}>
      <RiderInsightsDetailRoute />
    </QueryClientProvider>,
  );
  expect(mockRedirects).toEqual([{ pathname: PROFILE_ROUTE.RIDER_INSIGHTS }]);
});

it("sends an unknown group on Home's stack to Home's copy of Rider insights", async () => {
  mockParams = { group: 'lean-leaderboard' };
  mockSegments = ['(tabs)', '(home)', 'home', 'rider-insights', '[group]'];
  await render(
    <QueryClientProvider client={client}>
      <RiderInsightsDetailRoute />
    </QueryClientProvider>,
  );
  expect(mockRedirects).toEqual([{ pathname: HOME_ROUTE.RIDER_INSIGHTS }]);
});
