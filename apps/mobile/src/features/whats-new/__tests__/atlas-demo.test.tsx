// The Road Atlas demo: the rider's own routes sit on a real map fitted to them,
// drawn with the same camera so each line lands on its road; the example loops
// stay on a blank frame.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const element = (props: { children?: ReactNode }) => <View {...props} />;
  return { __esModule: true, default: element, Svg: element, Path: element };
});
const mockCamera = jest.fn();
jest.mock('@rnmapbox/maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      MapView: ({ children }: { children?: ReactNode }) => (
        <View testID="mapbox-map">{children}</View>
      ),
      Camera: (props: unknown) => {
        mockCamera(props);
        return null;
      },
    },
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { WHATS_NEW_DATA_KIND, WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { fitViewport, projectPoint } from '@/features/rider-insights/map-viewport';
import { space } from '@/theme/spacing';
import { ATLAS_LINE, type AtlasPageData, WHATS_NEW_DATA_SOURCE } from '../build-boot-snapshot';
import { AtlasDemo, projectOnMap } from '../pages/atlas-demo';
import { EXAMPLE_ROUTES, type RoutePath } from '../whats-new-examples';

const WIDTH = 320;
const HEIGHT = 400;

// Two short rides around Bratislava, as [lat, lng].
const RIDES: RoutePath[] = [
  [
    [48.14, 17.1],
    [48.2, 17.2],
    [48.25, 17.31],
  ],
  [
    [48.1, 17.05],
    [48.12, 17.15],
  ],
];

const MINE: AtlasPageData = {
  feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
  kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
  source: WHATS_NEW_DATA_SOURCE.CACHE,
  line: ATLAS_LINE.SEASON,
  distance: '1,324 km',
  rides: 18,
  newRoadShare: null,
  routes: RIDES,
};

const EXAMPLE: AtlasPageData = {
  feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
  kind: WHATS_NEW_DATA_KIND.EXAMPLE,
  source: WHATS_NEW_DATA_SOURCE.NONE,
  routes: EXAMPLE_ROUTES,
  unitLabel: 'km',
  season: null,
};

async function show(data: AtlasPageData) {
  await render(<AtlasDemo data={data} reduceMotion />);
  await fireEvent(screen.getByTestId('whats-new-atlas'), 'layout', {
    nativeEvent: { layout: { width: WIDTH, height: HEIGHT } },
  });
}

beforeEach(() => mockCamera.mockClear());

describe('projectOnMap', () => {
  it('fits the camera to every ride and puts each point where the map draws it', () => {
    const result = projectOnMap(RIDES, WIDTH, HEIGHT);
    expect(result).not.toBeNull();
    const viewport = fitViewport([17.05, 48.1, 17.31, 48.25], WIDTH, HEIGHT, space.xl);
    expect(result?.viewport).toEqual(viewport);
    const [x, y] = projectPoint([17.1, 48.14], viewport, WIDTH, HEIGHT);
    expect(result?.paths[0].d.startsWith(`M${x.toFixed(1)} ${y.toFixed(1)}`)).toBe(true);
  });

  it('gives nothing to draw without routes', () => {
    expect(projectOnMap([], WIDTH, HEIGHT)).toBeNull();
  });
});

describe('AtlasDemo', () => {
  it("draws the rider's routes over a map centred on them", async () => {
    await show(MINE);
    expect(screen.getByTestId('mapbox-map', { includeHiddenElements: true })).toBeTruthy();
    expect(mockCamera).toHaveBeenLastCalledWith(
      expect.objectContaining({
        centerCoordinate: projectOnMap(RIDES, WIDTH, HEIGHT)?.viewport.center,
      }),
    );
    expect(screen.getAllByTestId('whats-new-atlas-route')).toHaveLength(RIDES.length);
  });

  it('keeps the example loops on a blank frame, with no map', async () => {
    await show(EXAMPLE);
    expect(screen.queryByTestId('mapbox-map', { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByTestId('whats-new-atlas-route')).toHaveLength(EXAMPLE_ROUTES.length);
  });
});
