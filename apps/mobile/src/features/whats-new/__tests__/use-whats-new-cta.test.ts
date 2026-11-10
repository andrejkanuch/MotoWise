// A What's New page's button: one navigation action to the real feature, the
// page marked tried, the way back opened for Atlas and Notes, and the tap logged.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

const mockRouter = {
  dismissTo: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
};
const mockFocus: { current: (() => void) | null } = { current: null };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void) => {
    mockFocus.current = callback;
  },
}));

const mockScanOpen = jest.fn();
const mockScanEntry = jest.fn();
jest.mock('@/features/receipt-scan/receipt-scan-entry', () => ({
  useReceiptScanEntry: (args: unknown) => {
    mockScanEntry(args);
    return { open: mockScanOpen, remaining: 0, showFreeBadge: false, showUpsellBadge: true };
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import {
  FROM_WHATS_NEW,
  GARAGE_ROUTE,
  MODAL_ROUTE,
  PROFILE_ROUTE,
  RIDER_INSIGHTS_ENTRY,
} from '@/config/routes';
import { WHATS_NEW_TIMING } from '@/config/whats-new';
import { WHATS_NEW_DATA_KIND, WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { SCAN_ENTRY_SURFACE } from '@/features/receipt-scan/scan-flow-constants';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { useWhatsNewCta } from '../use-whats-new-cta';

const PRIMARY = { id: 'bike-primary', isPrimary: true };
const OTHER = { id: 'bike-other', isPrimary: false };

function renderCta(bikes: { id: string; isPrimary: boolean }[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  client.setQueryData(queryKeys.motorcycles.all, { myMotorcycles: bikes });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useWhatsNewCta(), { wrapper });
}

function expectNoSecondAction() {
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockRouter.navigate).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  useWhatsNewStore.setState({ triedFeatures: [], returnSessionOpen: false });
});

describe('Road Atlas', () => {
  it('dismisses to Profile’s Rider insights once, with the What’s New entry and the page', async () => {
    const { result } = await renderCta([OTHER, PRIMARY]);
    await act(() => result.current(WHATS_NEW_FEATURE.ROAD_ATLAS, 0, WHATS_NEW_DATA_KIND.YOUR_DATA));

    expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({
      pathname: PROFILE_ROUTE.RIDER_INSIGHTS,
      params: { entry: RIDER_INSIGHTS_ENTRY.WHATS_NEW, wnPage: '0' },
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expectNoSecondAction();
    expect(useWhatsNewStore.getState().triedFeatures).toEqual([WHATS_NEW_FEATURE.ROAD_ATLAS]);
    expect(useWhatsNewStore.getState().returnSessionOpen).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.WHATS_NEW_CTA_TAPPED, {
      feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
      data_kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      page_index: 0,
    });
  });
});

describe('double tap', () => {
  it('opens the feature once, and again only after What’s New is back in focus', async () => {
    const { result } = await renderCta([PRIMARY]);
    const tap = () =>
      result.current(WHATS_NEW_FEATURE.RECEIPT_SCAN, 1, WHATS_NEW_DATA_KIND.EXAMPLE);
    await act(tap);
    await act(tap);
    expect(mockScanOpen).toHaveBeenCalledTimes(1);

    await act(() => mockFocus.current?.());
    await act(tap);
    expect(mockScanOpen).toHaveBeenCalledTimes(2);
  });

  it('frees the button after the latch when the press opened no route (a native paywall)', async () => {
    jest.useFakeTimers();
    try {
      const { result } = await renderCta([PRIMARY]);
      const tap = () =>
        result.current(WHATS_NEW_FEATURE.RECEIPT_SCAN, 1, WHATS_NEW_DATA_KIND.EXAMPLE);
      await act(tap);
      await act(() => {
        jest.advanceTimersByTime(WHATS_NEW_TIMING.TAP_LATCH_MS);
      });
      await act(tap);
      expect(mockScanOpen).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Notes', () => {
  it('dismisses to the primary bike’s notes once, marked as opened from What’s New', async () => {
    const { result } = await renderCta([OTHER, PRIMARY]);
    await act(() => result.current(WHATS_NEW_FEATURE.NOTES_PHOTOS, 2, WHATS_NEW_DATA_KIND.EXAMPLE));

    expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({
      pathname: GARAGE_ROUTE.NOTES,
      params: { motorcycleId: PRIMARY.id, from: FROM_WHATS_NEW, wnPage: '2' },
    });
    expectNoSecondAction();
    expect(useWhatsNewStore.getState().triedFeatures).toEqual([WHATS_NEW_FEATURE.NOTES_PHOTOS]);
    expect(useWhatsNewStore.getState().returnSessionOpen).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.WHATS_NEW_CTA_TAPPED, {
      feature: WHATS_NEW_FEATURE.NOTES_PHOTOS,
      data_kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      page_index: 2,
    });
  });

  it('without a bike, opens add bike over What’s New instead of notes', async () => {
    const { result } = await renderCta([]);
    await act(() => result.current(WHATS_NEW_FEATURE.NOTES_PHOTOS, 1, WHATS_NEW_DATA_KIND.EXAMPLE));

    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith(MODAL_ROUTE.ADD_BIKE);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expectNoSecondAction();
    // The feature itself was not reached: not tried, and no way back to offer.
    expect(useWhatsNewStore.getState().triedFeatures).toEqual([]);
    expect(useWhatsNewStore.getState().returnSessionOpen).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.WHATS_NEW_CTA_TAPPED, {
      feature: WHATS_NEW_FEATURE.NOTES_PHOTOS,
      data_kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      page_index: 1,
    });
  });
});

describe('Scan a receipt', () => {
  it('opens the metered scan entry for the primary bike, staying over What’s New', async () => {
    const { result } = await renderCta([OTHER, PRIMARY]);
    await act(() =>
      result.current(WHATS_NEW_FEATURE.RECEIPT_SCAN, 1, WHATS_NEW_DATA_KIND.YOUR_DATA),
    );

    expect(mockScanEntry).toHaveBeenLastCalledWith({
      motorcycleId: PRIMARY.id,
      surface: SCAN_ENTRY_SURFACE.WHATS_NEW,
    });
    // The entry decides between the scan and the paywall (its quota is 0 here).
    expect(mockScanOpen).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expectNoSecondAction();
    expect(useWhatsNewStore.getState().triedFeatures).toEqual([WHATS_NEW_FEATURE.RECEIPT_SCAN]);
    // Closing the scan lands back on What's New natively: no return bar.
    expect(useWhatsNewStore.getState().returnSessionOpen).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.WHATS_NEW_CTA_TAPPED, {
      feature: WHATS_NEW_FEATURE.RECEIPT_SCAN,
      data_kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      page_index: 1,
    });
  });

  it('without a bike, opens add bike instead of the scan', async () => {
    const { result } = await renderCta([]);
    await act(() => result.current(WHATS_NEW_FEATURE.RECEIPT_SCAN, 1, WHATS_NEW_DATA_KIND.EXAMPLE));

    expect(mockScanOpen).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith(MODAL_ROUTE.ADD_BIKE);
    expect(useWhatsNewStore.getState().triedFeatures).toEqual([]);
  });
});
