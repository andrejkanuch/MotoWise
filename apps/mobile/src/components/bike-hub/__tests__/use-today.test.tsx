import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { refreshToday, useToday } from '../shell/use-today';

let appStateListeners: Array<(status: string) => void> = [];

beforeEach(() => {
  jest.useFakeTimers();
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (status: string) => void);
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useToday', () => {
  it('keeps the same Date within a calendar day, so derivations stay memoised', async () => {
    jest.setSystemTime(new Date(2026, 9, 2, 10, 0));
    const { result } = await renderHook(() => useToday());
    const first = result.current;
    expect(first.getDate()).toBe(2);
    jest.setSystemTime(new Date(2026, 9, 2, 23, 0));
    await act(async () => refreshToday());
    expect(result.current).toBe(first);
  });

  it('moves to the new day when the screen regains focus (refreshToday) after midnight', async () => {
    jest.setSystemTime(new Date(2026, 9, 2, 23, 50));
    const { result } = await renderHook(() => useToday());
    jest.setSystemTime(new Date(2026, 9, 3, 0, 10));
    await act(async () => refreshToday());
    expect(result.current.getDate()).toBe(3);
  });

  it('moves to the new day when the app returns to the foreground', async () => {
    jest.setSystemTime(new Date(2026, 9, 3, 9, 0));
    const { result } = await renderHook(() => useToday());
    expect(result.current.getDate()).toBe(3);
    jest.setSystemTime(new Date(2026, 9, 4, 7, 0));
    await act(async () => {
      for (const listener of appStateListeners) listener('background');
    });
    expect(result.current.getDate()).toBe(3);
    await act(async () => {
      for (const listener of appStateListeners) listener('active');
    });
    expect(result.current.getDate()).toBe(4);
  });

  it('a pinned date (tests) wins and never changes', async () => {
    const pinned = new Date(2026, 0, 15);
    const { result } = await renderHook(() => useToday(pinned));
    await act(async () => refreshToday());
    expect(result.current).toBe(pinned);
  });
});
