// The way back from a feature opened by a What's New page: shown only while that
// visit is open, one push back to the same page or on to the next one.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.28.0' }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
};
const mockFocus: { current: (() => void) | null } = { current: null };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void) => {
    mockFocus.current = callback;
  },
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { MODAL_ROUTE } from '@/config/routes';
import { WHATS_NEW_SOURCE } from '@/config/whats-new';
import { WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { WhatsNewReturnBar, whatsNewPageParam } from '../whats-new-return-bar';

const BACK = "Back to What's New";
const NEXT = 'Next feature';

beforeEach(() => {
  jest.clearAllMocks();
  useWhatsNewStore.setState({ returnSessionOpen: true });
});

describe('whatsNewPageParam', () => {
  it('reads a page index, and nothing from junk', () => {
    expect(whatsNewPageParam('2')).toBe(2);
    expect(whatsNewPageParam(['1'])).toBe(1);
    expect(whatsNewPageParam(undefined)).toBeNull();
    expect(whatsNewPageParam('-1')).toBeNull();
    expect(whatsNewPageParam('x')).toBeNull();
  });
});

describe('WhatsNewReturnBar', () => {
  it('is not drawn once the visit is closed, even with the What’s New param', async () => {
    useWhatsNewStore.setState({ returnSessionOpen: false });
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.ROAD_ATLAS} fromWhatsNew page={0} />,
    );
    expect(screen.queryByText(BACK)).toBeNull();
  });

  it('is not drawn on a screen not opened from What’s New', async () => {
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.ROAD_ATLAS} fromWhatsNew={false} page={0} />,
    );
    expect(screen.queryByText(BACK)).toBeNull();
  });

  it('page 1 of 3: Back reopens that page without the boot, Next the following page', async () => {
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.ROAD_ATLAS} fromWhatsNew page={0} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: BACK }));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: MODAL_ROUTE.WHATS_NEW,
      params: { source: WHATS_NEW_SOURCE.RETURN, resume: '0', noBoot: '1' },
    });
    expect(trackEvent).toHaveBeenLastCalledWith(AnalyticsEvent.WHATS_NEW_RETURNED, {
      feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
      action: 'back',
    });

    // The rider closed that What's New and is back on this screen.
    await act(() => mockFocus.current?.());
    await fireEvent.press(screen.getByRole('button', { name: NEXT }));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: MODAL_ROUTE.WHATS_NEW,
      params: { source: WHATS_NEW_SOURCE.RETURN, resume: '1', noBoot: '1' },
    });
    expect(trackEvent).toHaveBeenLastCalledWith(AnalyticsEvent.WHATS_NEW_RETURNED, {
      feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
      action: 'next',
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('on the last page offers no Next', async () => {
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.NOTES_PHOTOS} fromWhatsNew page={2} />,
    );
    expect(screen.getByRole('button', { name: BACK })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: NEXT })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: BACK }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: MODAL_ROUTE.WHATS_NEW,
      params: { source: WHATS_NEW_SOURCE.RETURN, resume: '2', noBoot: '1' },
    });
  });

  it('returns to the page the feature has on the way back, whatever index the visit gave it', async () => {
    // An auto-shown visit without the scan page put Notes second; the way back
    // shows the release's full set, where Notes is third.
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.NOTES_PHOTOS} fromWhatsNew page={1} />,
    );
    expect(screen.queryByRole('button', { name: NEXT })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: BACK }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: MODAL_ROUTE.WHATS_NEW,
      params: { source: WHATS_NEW_SOURCE.RETURN, resume: '2', noBoot: '1' },
    });
  });

  it('a double tap opens What’s New once', async () => {
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.ROAD_ATLAS} fromWhatsNew page={0} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: BACK }));
    await fireEvent.press(screen.getByRole('button', { name: BACK }));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('over What’s New (the scan): Back pops to it, Next asks it for the page after this feature', async () => {
    useWhatsNewStore.setState({ nextAfter: null });
    await render(
      <WhatsNewReturnBar feature={WHATS_NEW_FEATURE.RECEIPT_SCAN} fromWhatsNew page={1} stacked />,
    );

    await fireEvent.press(screen.getByRole('button', { name: BACK }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(useWhatsNewStore.getState().nextAfter).toBeNull();

    await act(() => mockFocus.current?.());
    await fireEvent.press(screen.getByRole('button', { name: NEXT }));
    expect(useWhatsNewStore.getState().nextAfter).toBe(WHATS_NEW_FEATURE.RECEIPT_SCAN);
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenLastCalledWith(AnalyticsEvent.WHATS_NEW_RETURNED, {
      feature: WHATS_NEW_FEATURE.RECEIPT_SCAN,
      action: 'next',
    });
  });
});
