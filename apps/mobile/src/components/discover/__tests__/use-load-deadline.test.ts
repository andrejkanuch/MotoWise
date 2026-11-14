// FS-PO7 (issue 365, T29): Discover shows an error and Retry once the ride list
// has been loading for 10 s, and Retry gives the next attempt a fresh window.

jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

import { act, renderHook } from '@testing-library/react-native';
import { DISCOVER_LOAD_TIMEOUT_MS } from '../use-discover-analytics';
import { useLoadDeadline } from '../use-load-deadline';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useLoadDeadline', () => {
  it('times out a load still pending at 10 s', async () => {
    const { result } = await renderHook(() => useLoadDeadline(true));
    expect(result.current.timedOut).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(DISCOVER_LOAD_TIMEOUT_MS - 1);
    });
    expect(result.current.timedOut).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.timedOut).toBe(true);
  });

  it('never times out a load that settled in time', async () => {
    const { result, rerender } = await renderHook(({ pending }) => useLoadDeadline(pending), {
      initialProps: { pending: true },
    });
    await rerender({ pending: false });
    await act(async () => {
      jest.advanceTimersByTime(DISCOVER_LOAD_TIMEOUT_MS * 2);
    });
    expect(result.current.timedOut).toBe(false);
  });

  it('restart clears the timeout and starts a fresh 10 s window', async () => {
    const { result } = await renderHook(() => useLoadDeadline(true));
    await act(async () => {
      jest.advanceTimersByTime(DISCOVER_LOAD_TIMEOUT_MS);
    });
    expect(result.current.timedOut).toBe(true);

    await act(async () => {
      result.current.restart();
    });
    expect(result.current.timedOut).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(DISCOVER_LOAD_TIMEOUT_MS);
    });
    expect(result.current.timedOut).toBe(true);
  });
});
