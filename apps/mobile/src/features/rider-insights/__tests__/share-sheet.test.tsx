// The season share sheet: which image a free and a Pro rider can pick, the
// locked poster's paywall, the ride-end toggle's default, a new capture for
// each size, and a poster that waits for its base map and never ships without it.
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
  // The load callbacks reach the host view, so a test can fire `load` or `error`.
  return {
    Image: (props: { testID?: string; onLoad?: () => void; onError?: () => void }) => (
      <View testID={props.testID} onLoad={props.onLoad} onError={props.onError} />
    ),
  };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  const None = () => null;
  return { __esModule: true, default: Box, Svg: Box, Path: None, Rect: None, Circle: None };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

/**
 * Settles every poster base map, the hidden capture copy's too. Called on the
 * props: that copy sits under `pointerEvents="none"`, which `fireEvent` respects.
 */
async function settleBases(callback: 'onLoad' | 'onError') {
  for (const base of screen.getAllByTestId('atlas-poster-base', { includeHiddenElements: true })) {
    await act(async () => base.props[callback]());
  }
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

  it('selects the card a Pro rider swipes to, and back', async () => {
    await renderSheet(proInsights());
    const carousel = screen.getByTestId('share-options');
    await fireEvent(carousel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 400, y: 0 } },
    });
    expect(checked('share-option-atlasPoster')).toBe(true);
    await fireEvent(carousel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 0 } },
    });
    expect(checked('share-option-seasonLines')).toBe(true);
  });

  it('never opens the paywall on a swipe to the locked poster', async () => {
    await renderSheet(freeInsights());
    await fireEvent(screen.getByTestId('share-options'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 400, y: 0 } },
    });
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(checked('share-option-seasonLines')).toBe(true);
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

  describe('with a Mapbox token, so the poster has a base map', () => {
    const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    beforeEach(() => {
      process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'test-token';
    });
    afterEach(() => {
      process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = token;
    });

    it('waits for the poster base map, and shares no poster when the map fails', async () => {
      await renderSheet(proInsights());
      await fireEvent.press(screen.getByTestId('share-option-atlasPoster'));
      expect(screen.getByTestId('share-share').props.accessibilityState.disabled).toBe(true);

      // Both the capture copy and the preview fail to load the map.
      await settleBases('onError');
      expect(screen.getByTestId('share-share').props.accessibilityState.disabled).toBe(false);

      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await fireEvent.press(screen.getByTestId('share-save'));
      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith('Error', 'Something went wrong. Please try again.'),
      );
      alert.mockRestore();
      expect(mockCapture).not.toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
      expect(screen.getByTestId('share-share').props.accessibilityState.disabled).toBe(false);
    });

    it('captures the poster once its base map loaded, and waits again after leaving it', async () => {
      await renderSheet(proInsights());
      await fireEvent.press(screen.getByTestId('share-option-atlasPoster'));
      await settleBases('onLoad');

      await fireEvent.press(screen.getByTestId('share-save'));
      await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(1));

      // Back to season lines and to the poster: its new capture copy has not loaded yet.
      await fireEvent.press(screen.getByTestId('share-option-seasonLines'));
      await fireEvent.press(screen.getByTestId('share-option-atlasPoster'));
      expect(screen.getByTestId('share-share').props.accessibilityState.disabled).toBe(true);
    });
  });
});
