import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { UNDO_WINDOW_MS } from '../../../lib/bike-hub/constants';
import { usePendingDeleteStore } from '../../../stores/pending-delete.store';
import { useDeferredDelete } from '../ui/use-deferred-delete';

type Commit = (id: string) => Promise<unknown>;

const hidden = () => Object.keys(usePendingDeleteStore.getState().hiddenIds);

async function setup(
  commit: jest.MockedFunction<Commit> = jest.fn().mockResolvedValue(true),
  windowMs?: number,
) {
  const onError = jest.fn();
  const hook = await renderHook(
    (props: { commit: Commit; windowMs?: number }) => useDeferredDelete({ ...props, onError }),
    { initialProps: { commit, windowMs } },
  );
  return { commit, onError, ...hook };
}

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

/** A commit the test settles by hand, to look at the moment the request is in flight. */
function deferredCommit() {
  let resolve: (value: unknown) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const commit: jest.MockedFunction<Commit> = jest.fn(
    () =>
      new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return { commit, resolve: () => resolve(true), reject: (error: Error) => reject(error) };
}

// React Native's jest AppState returns no subscription; stand in for it and keep the listeners.
let appStateListeners: Array<(status: AppStateStatus) => void> = [];
const emitAppState = (status: AppStateStatus) =>
  act(async () => {
    for (const listener of appStateListeners) listener(status);
  });

beforeEach(() => {
  jest.useFakeTimers();
  usePendingDeleteStore.setState({ hiddenIds: {} });
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (status: AppStateStatus) => void);
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useDeferredDelete — the 5 s window', () => {
  it('the window is 5 seconds', () => {
    expect(UNDO_WINDOW_MS).toBe(5000);
  });

  it('commits exactly once after the timeout, however long the screen stays open', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS * 4);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('note-1');
  });

  it('keeps the row hidden while the delete is in flight, and lets go of it once it lands', async () => {
    // Arrange
    const { commit, resolve } = deferredCommit();
    const { result } = await setup(commit);
    await act(async () => result.current.request('note-1'));

    // Act
    await advance(UNDO_WINDOW_MS);

    // Assert
    expect(commit).toHaveBeenCalledTimes(1);
    expect(hidden()).toEqual(['note-1']);
    expect(result.current.pendingId).toBeNull();
    await act(async () => resolve());
    expect(hidden()).toEqual([]);
  });

  it('Undo after the window has closed does nothing: the delete was sent once', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS);
    await act(async () => result.current.undo());
    await advance(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.pendingId).toBeNull();
  });

  it('Undo at the last millisecond still cancels', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS - 1);
    await act(async () => result.current.undo());
    await advance(UNDO_WINDOW_MS);
    expect(commit).not.toHaveBeenCalled();
    expect(hidden()).toEqual([]);
  });

  it('Undo twice is harmless', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.undo());
    await act(async () => result.current.undo());
    await advance(UNDO_WINDOW_MS);
    expect(commit).not.toHaveBeenCalled();
    expect(hidden()).toEqual([]);
  });

  it('Undo and a blur with nothing pending send nothing', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.undo());
    await act(async () => result.current.flush());
    await advance(UNDO_WINDOW_MS);
    expect(commit).not.toHaveBeenCalled();
  });

  it('a note restored with Undo can be deleted again, and is then sent once', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.undo());
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('note-1');
  });

  it('honours a custom window length', async () => {
    const shortWindowMs = 1000;
    const { result, commit } = await setup(undefined, shortWindowMs);
    await act(async () => result.current.request('note-1'));
    await advance(shortWindowMs - 1);
    expect(commit).not.toHaveBeenCalled();
    await advance(1);
    expect(commit).toHaveBeenCalledWith('note-1');
  });
});

describe('useDeferredDelete — two deletes in a row', () => {
  it('the second delete gets its own full 5 s, not what was left of the first', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(3000);
    await act(async () => result.current.request('note-2'));
    expect(commit).toHaveBeenCalledTimes(1);

    await advance(UNDO_WINDOW_MS - 1);
    expect(commit).toHaveBeenCalledTimes(1);
    await advance(1);

    expect(commit.mock.calls).toEqual([['note-1'], ['note-2']]);
    expect(hidden()).toEqual([]);
  });

  it('Undo after the second delete restores the second only — the first is already gone', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.request('note-2'));
    await act(async () => result.current.undo());
    await advance(UNDO_WINDOW_MS * 2);
    expect(commit.mock.calls).toEqual([['note-1']]);
    expect(hidden()).toEqual([]);
    expect(result.current.pendingId).toBeNull();
  });

  it('three quick deletes are each sent exactly once, in order', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.request('note-2'));
    await act(async () => result.current.request('note-3'));
    expect(commit.mock.calls).toEqual([['note-1'], ['note-2']]);
    await advance(UNDO_WINDOW_MS);
    expect(commit.mock.calls).toEqual([['note-1'], ['note-2'], ['note-3']]);
  });

  it('the first delete failing restores that row and leaves the second pending', async () => {
    // Arrange
    const failure = new Error('offline');
    const commit: jest.MockedFunction<Commit> = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(true);
    const { result, onError } = await setup(commit);

    // Act
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.request('note-2'));

    // Assert
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('note-1', failure);
    expect(hidden()).toEqual(['note-2']);
    expect(result.current.pendingId).toBe('note-2');
    await advance(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenLastCalledWith('note-2');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('both rows stay hidden while the first delete is still in flight', async () => {
    const { commit, resolve } = deferredCommit();
    const { result } = await setup(commit);
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.request('note-2'));
    expect(hidden().sort()).toEqual(['note-1', 'note-2']);
    await act(async () => resolve());
    expect(hidden()).toEqual(['note-2']);
  });
});

describe('useDeferredDelete — leaving, blur and the app state', () => {
  it('unmounting inside the window commits the pending delete once', async () => {
    const { result, commit, unmount } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(2000);
    await unmount();
    await advance(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('note-1');
  });

  it('unmounting after Undo sends nothing', async () => {
    const { result, commit, unmount } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.undo());
    await unmount();
    await advance(UNDO_WINDOW_MS);
    expect(commit).not.toHaveBeenCalled();
  });

  it('unmounting after the window closed does not send the delete again', async () => {
    const { result, commit, unmount } = await setup();
    await act(async () => result.current.request('note-1'));
    await advance(UNDO_WINDOW_MS);
    await unmount();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('unmounting with nothing pending sends nothing', async () => {
    const { commit, unmount } = await setup();
    await unmount();
    expect(commit).not.toHaveBeenCalled();
  });

  it('a delete that fails after the screen is gone still restores the row and reports it', async () => {
    const failure = new Error('offline');
    const { result, onError, unmount } = await setup(jest.fn().mockRejectedValue(failure));
    await act(async () => result.current.request('note-1'));
    await unmount();
    await advance(0);
    expect(onError).toHaveBeenCalledWith('note-1', failure);
    expect(hidden()).toEqual([]);
  });

  it('a blur (flush) then Undo: the delete is already sent and stays sent', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.flush());
    await act(async () => result.current.undo());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.pendingId).toBeNull();
  });

  it('two blurs in a row send the delete once', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await act(async () => result.current.flush());
    await act(async () => result.current.flush());
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('the app going to the background closes the window at once', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await emitAppState('background');
    expect(commit).toHaveBeenCalledTimes(1);
    await advance(UNDO_WINDOW_MS);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  // Control Center, the notification shade and call banners report 'inactive'
  // without leaving the app: the rider can still tap Undo.
  it('the app becoming inactive keeps the undo window open', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await emitAppState('inactive');
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pendingId).toBe('note-1');
    await emitAppState('active');
    await act(async () => result.current.undo());
    await advance(UNDO_WINDOW_MS);
    expect(commit).not.toHaveBeenCalled();
  });

  it('the app becoming active again does not close the window', async () => {
    const { result, commit } = await setup();
    await act(async () => result.current.request('note-1'));
    await emitAppState('active');
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pendingId).toBe('note-1');
  });

  it('uses the latest commit function when the window closes', async () => {
    const stale: jest.MockedFunction<Commit> = jest.fn().mockResolvedValue(true);
    const fresh: jest.MockedFunction<Commit> = jest.fn().mockResolvedValue(true);
    const { result, rerender } = await setup(stale);
    await act(async () => result.current.request('note-1'));
    await rerender({ commit: fresh });
    await advance(UNDO_WINDOW_MS);
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledWith('note-1');
  });
});
