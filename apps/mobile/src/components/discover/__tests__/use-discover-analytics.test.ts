jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

import { act, renderHook } from '@testing-library/react-native';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import {
  DISCOVER_LOAD_TIMEOUT_MS,
  type DiscoverLoadState,
  SCREEN_LOAD_OUTCOME,
  SCREEN_LOAD_SCREEN,
  useDiscoverAnalytics,
} from '../use-discover-analytics';

const loadEvents = () =>
  jest
    .mocked(trackEvent)
    .mock.calls.filter(([event]) => event === AnalyticsEvent.SCREEN_LOAD_TIMED);

async function mount(initial: DiscoverLoadState) {
  return renderHook((state: DiscoverLoadState) => useDiscoverAnalytics(state), {
    initialProps: initial,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(10_000);
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('useDiscoverAnalytics', () => {
  it('reports discover_tab_viewed once on open', async () => {
    const { rerender } = await mount({ status: 'pending', itemCount: 0 });
    await rerender({ status: 'success', itemCount: 3 });
    expect(
      jest.mocked(trackEvent).mock.calls.filter(([e]) => e === AnalyticsEvent.DISCOVER_TAB_VIEWED),
    ).toHaveLength(1);
  });

  it('times the first content once', async () => {
    const { rerender } = await mount({ status: 'pending', itemCount: 0 });
    jest.setSystemTime(11_200);
    await rerender({ status: 'success', itemCount: 20 });
    await rerender({ status: 'pending', itemCount: 0 });
    await rerender({ status: 'success', itemCount: 4 });

    expect(loadEvents()).toEqual([
      [
        AnalyticsEvent.SCREEN_LOAD_TIMED,
        {
          screen: SCREEN_LOAD_SCREEN.DISCOVER,
          ms_to_content: 1_200,
          outcome: SCREEN_LOAD_OUTCOME.CONTENT,
        },
      ],
    ]);
  });

  it('reports an empty list and an error as their own outcomes', async () => {
    await mount({ status: 'success', itemCount: 0 });
    await mount({ status: 'error', itemCount: 0 });
    expect(loadEvents().map(([, properties]) => properties?.outcome)).toEqual([
      SCREEN_LOAD_OUTCOME.EMPTY,
      SCREEN_LOAD_OUTCOME.ERROR,
    ]);
  });

  it('reports a timeout when nothing settles in time, and nothing after it', async () => {
    const { rerender } = await mount({ status: 'pending', itemCount: 0 });
    await act(async () => {
      jest.advanceTimersByTime(DISCOVER_LOAD_TIMEOUT_MS);
    });
    await rerender({ status: 'success', itemCount: 5 });

    expect(loadEvents()).toEqual([
      [
        AnalyticsEvent.SCREEN_LOAD_TIMED,
        {
          screen: SCREEN_LOAD_SCREEN.DISCOVER,
          ms_to_content: DISCOVER_LOAD_TIMEOUT_MS,
          outcome: SCREEN_LOAD_OUTCOME.TIMEOUT,
        },
      ],
    ]);
  });

  it('reports nothing when the screen closes before the list settles', async () => {
    const { unmount } = await mount({ status: 'pending', itemCount: 0 });
    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(DISCOVER_LOAD_TIMEOUT_MS);
    });
    expect(loadEvents()).toHaveLength(0);
  });
});
