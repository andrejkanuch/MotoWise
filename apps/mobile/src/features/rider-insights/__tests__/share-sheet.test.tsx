// The season share sheet: which image a free and a Pro rider can pick, the
// locked poster's paywall, the ride-end toggle's default, and a new capture
// for each size.
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
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: jest.fn(async () => ({ me: { publicUsername: 'andrej_k11' } })),
}));

const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentRiderInsightsPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));

const mockCapture = jest.fn();
jest.mock('@/components/share/render-share-card', () => ({
  getExportCardDimensions: (px: { width: number; height: number }) => ({
    width: px.width / 3,
    height: px.height / 3,
  }),
  captureShareImage: (...args: unknown[]) => mockCapture(...args),
}));

const mockSave = jest.fn();
jest.mock('@/components/share/share-destinations', () => ({
  executeShareDestination: (...args: unknown[]) => mockSave(...args),
  getToastMessage: () => null,
}));
jest.mock('react-native-share', () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock('@/components/ui/native-toggle', () => ({ NativeToggle: () => null }));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: { testID?: string }) => <View testID={props.testID} /> };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  const None = () => null;
  return { __esModule: true, default: Box, Svg: Box, Path: None, Rect: None, Circle: None };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { RIDER_INSIGHTS_PAYWALL_ROW } from '@/lib/paywall-surfaces';
import { freeInsights, type InsightsPayload, proInsights } from '@/test/rider-insights-fixtures';
import { InsightsShareSheet } from '../share-sheet';

const regionName = (region: { name: string | null }) => region.name ?? 'Unnamed';

async function renderSheet(insights: InsightsPayload, onPurchased = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <InsightsShareSheet
        visible
        onClose={jest.fn()}
        insights={insights}
        regions={insights.regions}
        regionName={regionName}
        system="metric"
        unlocking={false}
        onPurchased={onPurchased}
      />
    </QueryClientProvider>,
  );
}

const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;

beforeEach(() => {
  mockPresentPaywall.mockReset();
  mockCapture.mockReset();
  mockCapture.mockResolvedValue('file:///cache/share.png');
  mockSave.mockReset();
  mockSave.mockResolvedValue({ success: true });
});

describe('InsightsShareSheet', () => {
  it('offers a free rider season lines, with the poster locked', async () => {
    await renderSheet(freeInsights());
    expect(checked('share-option-seasonLines')).toBe(true);
    expect(screen.getByTestId('share-poster-locked')).toBeTruthy();
    // The locked poster is a button to the paywall, not a choice.
    expect(screen.getByTestId('share-option-atlasPoster').props.accessibilityRole).toBe('button');
    expect(checked('share-option-atlasPoster')).toBeUndefined();
  });

  it('opens the paywall straight from the locked poster and keeps season lines chosen', async () => {
    const onPurchased = jest.fn();
    mockPresentPaywall.mockResolvedValue('purchased');
    await renderSheet(freeInsights(), onPurchased);

    await fireEvent.press(screen.getByTestId('share-option-atlasPoster'));

    expect(mockPresentPaywall).toHaveBeenCalledWith(
      RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER,
      expect.objectContaining({ headline: expect.any(String) }),
    );
    expect(onPurchased).toHaveBeenCalled();
    expect(checked('share-option-seasonLines')).toBe(true);
  });

  it('lets a Pro rider pick the poster without a paywall', async () => {
    await renderSheet(proInsights());
    expect(screen.queryByTestId('share-poster-locked')).toBeNull();

    await fireEvent.press(screen.getByTestId('share-option-atlasPoster'));

    expect(checked('share-option-atlasPoster')).toBe(true);
    expect(mockPresentPaywall).not.toHaveBeenCalled();
  });

  it('hides the ride start and end by default', async () => {
    await renderSheet(freeInsights());
    expect(checked('share-hide-ends')).toBe(true);
  });

  it('captures a new image when the size changes', async () => {
    await renderSheet(freeInsights());

    await fireEvent.press(screen.getByTestId('share-save'));
    await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(1));
    const [, feedKey, feedPixels] = mockCapture.mock.calls[0];
    expect(feedPixels).toEqual({ width: 1080, height: 1350 });

    await fireEvent.press(screen.getByTestId('share-size-story'));
    await fireEvent.press(screen.getByTestId('share-save'));
    await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(2));
    const [, storyKey, storyPixels] = mockCapture.mock.calls[1];
    expect(storyPixels).toEqual({ width: 1080, height: 1920 });
    expect(storyKey).not.toBe(feedKey);
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        'saveImage',
        'file:///cache/share.png',
        expect.any(String),
      ),
    );
  });
});
