import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { UNDO_WINDOW_MS } from '@/lib/bike-hub/constants';
import { usePendingDeleteStore } from '@/stores/pending-delete.store';
import { useDeferredDelete } from '../ui/use-deferred-delete';

const hidden = () => Object.keys(usePendingDeleteStore.getState().hiddenIds);

async function setup(commit = jest.fn().mockResolvedValue(true)) {
  const onError = jest.fn();
  const hook = await renderHook(() => useDeferredDelete({ commit, onError }));
  return { commit, onError, ...hook };
}

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

// React Native's jest AppState returns no subscription; stand in for it and keep the listeners.
let appStateListeners: Array<(status: string) => void> = [];

beforeEach(() => {
  jest.useFakeTimers();
  usePendingDeleteStore.setState({ hiddenIds: {} });
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

describe('useDeferredDelete', () => {
  it('hides the row at once and sends nothing yet', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    expect(hidden()).toEqual(['note-1']);
    expect(result.current.pendingId).toBe('note-1');
    expect(commit).not.toHaveBeenCalled();
  });

  it('Undo within the window: the delete is never sent and the row is back', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS - 1000);
    await act(async () => result.current.undo());
    await advance(UNDO_WINDOW_MS);
    expect(commit).not.toHaveBeenCalled();
    expect(hidden()).toEqual([]);
    expect(result.current.pendingId).toBeNull();
  });

  it('sends the delete once when the 5 s window closes', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    await advance(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('note-1');
    expect(result.current.pendingId).toBeNull();
    expect(hidden()).toEqual([]);
  });

  it('a blur at 2 s (flush) sends it at once, and not again later', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(2000);
    await act(async () => result.current.flush());
    expect(commit).toHaveBeenCalledTimes(1);
    await advance(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('the app going to the background sends it at once', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => {
      for (const listener of appStateListeners) listener('background');
    });
    expect(commit).toHaveBeenCalledWith('note-1');
  });

  it('a second delete commits the first immediately', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.request('note-2'));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('note-1');
    expect(result.current.pendingId).toBe('note-2');
    expect(hidden()).toEqual(['note-2']);
  });

  it('a failed delete restores the row and reports the error', async () => {
    const failure = new Error('offline');
    const { result, onError } = await setup(jest.fn().mockRejectedValue(failure));
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS);
    expect(onError).toHaveBeenCalledWith('note-1', failure);
    expect(hidden()).toEqual([]);
  });

  it('unmounting (leaving the screen) closes the window', async () => {
    const { result, commit, unmount } = await setup();
    await act(async () => result.current.request('note-1'));
    await unmount();
    expect(commit).toHaveBeenCalledWith('note-1');
  });
});
