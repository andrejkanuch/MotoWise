// The hero map decodes the region's routes once, not on every render.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: Box, Svg: Box, Path: () => null };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: () => <View /> };
});
const mockShapes: unknown[] = [];
jest.mock('@rnmapbox/maps', () => {
  const { View } = require('react-native');
  const Pass = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return {
    __esModule: true,
    default: {
      MapView: Pass,
      Camera: () => null,
      ShapeSource: ({ shape, children }: { shape: unknown; children?: ReactNode }) => {
        mockShapes.push(shape);
        return <View>{children}</View>;
      },
      LineLayer: () => null,
    },
  };
});

import { render } from '@testing-library/react-native';
import { freeInsights } from '@/test/rider-insights-fixtures';
import { AtlasHero } from '../atlas-hero';

const insights = freeInsights();
const region = insights.regions[0] ?? null;

function hero(width: number) {
  return (
    <AtlasHero
      region={region}
      totals={insights.totals}
      countries={insights.countries}
      mapAvailable
      width={width}
      system="metric"
      regionName={(r) => r.name ?? r.key}
      regionMeta={(r) => r.key}
      onOpenCountries={() => {}}
    />
  );
}

beforeEach(() => {
  mockShapes.length = 0;
});

it('keeps the same route shape while the region is unchanged', async () => {
  const view = await render(hero(358));
  await view.rerender(hero(357));
  expect(mockShapes.length).toBeGreaterThanOrEqual(2);
  expect(mockShapes.at(-1)).toBe(mockShapes[0]);
});
