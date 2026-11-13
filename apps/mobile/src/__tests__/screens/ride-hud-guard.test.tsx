// The ride HUD's minimum-ride guard (issue 365, T05c): the `ride_too_short_shown` shape
// (gps_fix, max_speed_kmh, has_real_ride, variant) and the ids Maestro drives the
// sheet by. Lives outside src/app: every file there is bundled as a route.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../utils/haptics', () => ({ triggerImpact: jest.fn() }));
jest.mock('../../utils/ride-sync-queue', () => ({ hasPendingSyncWork: () => false }));
jest.mock('../../features/ride/use-ride-elapsed', () => ({ useRideElapsed: () => mockElapsed }));
jest.mock('../../features/ride/use-battery-saver-toggle', () => ({
  useBatterySaverToggle: () => jest.fn(),
}));
jest.mock('../../features/ride/gps-lost-banner', () => ({ GpsLostBanner: () => null }));
jest.mock('../../features/ride/ride-controller', () => ({
  buildRideSummaryHref: jest.fn(() => '/ride-summary'),
  endRideSession: jest.fn(() => null),
  pauseRideSession: jest.fn(),
  resumeRideSession: jest.fn(),
}));
jest.mock('../../components/ride/hud-layout-switcher', () => ({ HudLayoutSwitcher: () => null }));
jest.mock('../../components/ride/hud-layout-a', () => ({
  HudLayoutA: ({ onEndRide }: { onEndRide: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onEndRide}>
        <Text>mock-end-ride</Text>
      </Pressable>
    );
  },
}));
jest.mock('../../components/ride/hud-layout-b', () => ({ HudLayoutB: () => null }));
jest.mock('../../utils/ride-storage', () => ({
  ...jest.requireActual('../../utils/ride-storage'),
  getPointBuffer: () => mockPointBuffer,
  getWaypointChunks: () => [],
}));
// The sheet renders its children inline; the test reads the props the HUD passes.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef(
    (props: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      mockSheetProps = props as unknown as Record<string, unknown>;
      React.useImperativeHandle(ref, () => ({ expand: jest.fn(), close: jest.fn() }));
      return <View>{props.children}</View>;
    },
  );
  return { __esModule: true, default: BottomSheet };
});

import { type MyRidesQuery, RideStatus } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import RideHudScreen from '../../app/(modals)/ride-hud';
import { endRideSession } from '../../features/ride/ride-controller';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { queryKeys } from '../../lib/query-keys';
import { useRideStore } from '../../stores/ride.store';
import { rideMMKV } from '../../utils/ride-storage';

let mockElapsed = 0;
let mockPointBuffer: unknown[] = [];
let mockSheetProps: Record<string, unknown> = {};
const mockTrackEvent = jest.mocked(trackEvent);
const RIDE_ID = 'ride-1';
const HOME_RIDES = queryKeys.rides.list('home');

type RideNode = MyRidesQuery['myRides']['edges'][number]['node'];

function ridesPage(nodes: Partial<RideNode>[], totalCount = nodes.length): MyRidesQuery {
  return {
    myRides: {
      edges: nodes.map((node, i) => ({ cursor: String(i), node: node as RideNode })),
      pageInfo: { hasNextPage: totalCount > nodes.length, endCursor: null },
      totalCount,
    },
  };
}

function renderHud(seed?: (client: QueryClient) => void) {
  const client = new QueryClient();
  seed?.(client);
  return render(
    <QueryClientProvider client={client}>
      <RideHudScreen />
    </QueryClientProvider>,
  );
}

function guardCalls() {
  return mockTrackEvent.mock.calls.filter(
    ([event]) => event === AnalyticsEvent.RIDE_TOO_SHORT_SHOWN,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockElapsed = 12;
  mockPointBuffer = [];
  mockSheetProps = {};
  rideMMKV.setCurrentId(RIDE_ID);
  // 0.5 m/s = 1.8 km/h: a rider standing in the driveway.
  useRideStore.setState({ status: 'recording', distance: 3.4, maxSpeed: 0.5 });
});

describe('ride HUD minimum-ride guard', () => {
  it('sends gps_fix, max_speed_kmh, has_real_ride and variant when the sheet is shown', async () => {
    mockPointBuffer = [{ latitude: 1, longitude: 2 }];
    await renderHud((client) =>
      client.setQueryData(
        HOME_RIDES,
        ridesPage([{ id: 'r0', status: RideStatus.Completed, durationS: 900, distanceM: 12_000 }]),
      ),
    );

    await fireEvent.press(screen.getByText('mock-end-ride'));

    expect(guardCalls()).toEqual([
      [
        AnalyticsEvent.RIDE_TOO_SHORT_SHOWN,
        {
          ride_id: RIDE_ID,
          elapsed_s: 12,
          distance_m: 3,
          action: 'shown',
          gps_fix: true,
          max_speed_kmh: 1.8,
          has_real_ride: true,
          variant: 'default',
        },
      ],
    ]);
  });

  it('reports no fix and an unknown ride history, and repeats the shape on Keep riding', async () => {
    await renderHud();

    await fireEvent.press(screen.getByText('mock-end-ride'));
    await fireEvent.press(screen.getByTestId('ride-guard-keep'));

    const shape = {
      ride_id: RIDE_ID,
      elapsed_s: 12,
      distance_m: 3,
      gps_fix: false,
      max_speed_kmh: 1.8,
      has_real_ride: null,
      variant: 'default',
    };
    expect(guardCalls()).toEqual([
      [AnalyticsEvent.RIDE_TOO_SHORT_SHOWN, { ...shape, action: 'shown' }],
      [AnalyticsEvent.RIDE_TOO_SHORT_SHOWN, { ...shape, action: 'keep' }],
    ]);
  });

  it('counts only completed rides over both floors as real', async () => {
    await renderHud((client) =>
      client.setQueryData(
        HOME_RIDES,
        ridesPage([
          { id: 'r1', status: RideStatus.Recording, durationS: 900, distanceM: 12_000 },
          { id: 'r2', status: RideStatus.Completed, durationS: 20, distanceM: 4 },
        ]),
      ),
    );

    await fireEvent.press(screen.getByText('mock-end-ride'));

    expect(guardCalls()[0][1]).toMatchObject({ has_real_ride: false });
  });

  it('exposes the sheet and its buttons to the accessibility tree by id', async () => {
    await renderHud();
    expect(screen.getByTestId('ride-hud-root')).toBeTruthy();

    await fireEvent.press(screen.getByText('mock-end-ride'));

    // A @gorhom sheet is one `accessible` element by default, which hides its
    // buttons from VoiceOver and from Maestro.
    expect(mockSheetProps.accessible).toBe(false);
    expect(screen.getByTestId('ride-guard-sheet')).toBeTruthy();
    expect(screen.getByTestId('ride-guard-variant-default')).toBeTruthy();
    expect(screen.getByTestId('ride-guard-keep').props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('ride-guard-end-anyway').props.accessibilityRole).toBe('button');

    await fireEvent.press(screen.getByTestId('ride-guard-end-anyway'));
    expect(endRideSession).toHaveBeenCalledWith('phone');
    expect(guardCalls().at(-1)?.[1]).toMatchObject({ action: 'end', variant: 'default' });
  });
});
