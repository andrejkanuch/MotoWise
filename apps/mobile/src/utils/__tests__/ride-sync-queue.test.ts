// Capture the single MMKV instance the module creates so tests can seed/inspect it.
let mockSyncStore: Map<string, string | number | boolean>;

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string | number | boolean>();
    mockSyncStore = store;
    return {
      getString: (k: string) => {
        const v = store.get(k);
        return typeof v === 'string' ? v : undefined;
      },
      getNumber: (k: string) => {
        const v = store.get(k);
        return typeof v === 'number' ? v : undefined;
      },
      set: (k: string, v: string | number | boolean) => store.set(k, v),
      remove: (k: string) => store.delete(k),
    };
  },
}));

const mockGetNetworkStateAsync = jest.fn();
jest.mock('expo-network', () => ({
  getNetworkStateAsync: () => mockGetNetworkStateAsync(),
}));

const mockGqlFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockGqlFetcher(...args),
}));

jest.mock('../../lib/analytics', () => ({ captureException: jest.fn() }));

import { captureException } from '../../lib/analytics';
import {
  clearDeliveredQueue,
  destroyAllSyncData,
  drainQueue,
  enqueue,
  enqueueOrExecute,
  getDeadLetterCount,
  getPendingCount,
  getQueueLength,
  hasPendingSyncWork,
  redriveDeadLetterQueue,
  setDeadLetterListener,
} from '../ride-sync-queue';

const mockCapture = captureException as jest.Mock;

const ONLINE = { isConnected: true, isInternetReachable: true };
const OFFLINE = { isConnected: false, isInternetReachable: false };

function gqlError(code: string): { response: { errors: { extensions: { code: string } }[] } } {
  return { response: { errors: [{ extensions: { code } }] } };
}

function queue(): { seq: number; type: string; retries: number }[] {
  const raw = mockSyncStore.get('sync.queue');
  return typeof raw === 'string' ? JSON.parse(raw) : [];
}

function deadLetter(): unknown[] {
  const raw = mockSyncStore.get('sync.dead_letter');
  return typeof raw === 'string' ? JSON.parse(raw) : [];
}

beforeEach(() => {
  destroyAllSyncData();
  mockGqlFetcher.mockReset();
  mockCapture.mockReset();
  setDeadLetterListener(null);
  mockGetNetworkStateAsync.mockReset().mockResolvedValue(ONLINE);
});

describe('enqueue / sequence ordering', () => {
  it('assigns strictly increasing seq numbers and grows the queue', () => {
    enqueue('startRide', { variables: { a: 1 } });
    enqueue('uploadWaypoints', { variables: { b: 2 } });
    expect(getQueueLength()).toBe(2);

    const queue = JSON.parse(mockSyncStore.get('sync.queue') as string) as { seq: number }[];
    expect(queue.map((o) => o.seq)).toEqual([1, 2]);
  });

  it('destroyAllSyncData empties the queue and seq counter', () => {
    enqueue('endRide', { variables: {} });
    destroyAllSyncData();
    expect(getQueueLength()).toBe(0);
  });
});

describe('enqueueOrExecute', () => {
  it('executes immediately and does not enqueue when online and the call succeeds', async () => {
    mockGqlFetcher.mockResolvedValueOnce({});
    await enqueueOrExecute('startRide', { variables: { input: {} } });
    expect(mockGqlFetcher).toHaveBeenCalledTimes(1);
    expect(getQueueLength()).toBe(0);
  });

  it('enqueues for later when offline', async () => {
    mockGetNetworkStateAsync.mockResolvedValue(OFFLINE);
    await enqueueOrExecute('endRide', { variables: { input: {} } });
    expect(mockGqlFetcher).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });

  it('swallows NOT_FOUND on deleteRide without enqueuing (idempotent delete)', async () => {
    mockGqlFetcher.mockRejectedValueOnce(new Error('{"code":"NOT_FOUND"}'));
    await enqueueOrExecute('deleteRide', { variables: { id: 'x' } });
    expect(getQueueLength()).toBe(0);
  });
});

describe('drainQueue', () => {
  it('drains successful operations and empties the queue', async () => {
    enqueue('startRide', { variables: { input: {} } });
    enqueue('endRide', { variables: { input: {} } });
    mockGqlFetcher.mockResolvedValue({});

    await drainQueue();

    expect(mockGqlFetcher).toHaveBeenCalledTimes(2);
    expect(getQueueLength()).toBe(0);
  });

  it('retains a failed op with an incremented retry count (first failure, no dead-letter)', async () => {
    enqueue('updateRide', { variables: { input: {} } });
    mockGqlFetcher.mockRejectedValue(new Error('boom'));

    await drainQueue();

    expect(getQueueLength()).toBe(1);
    const [op] = JSON.parse(mockSyncStore.get('sync.queue') as string) as { retries: number }[];
    expect(op.retries).toBe(1);
    expect(deadLetter()).toHaveLength(0);
  });

  it('promotes an op to the dead-letter queue after MAX_RETRIES', async () => {
    // Seed an op already at retries=4; one more failure crosses MAX_RETRIES (5).
    mockSyncStore.set(
      'sync.queue',
      JSON.stringify([
        { seq: 1, type: 'updateRide', payload: { variables: {} }, retries: 4, createdAt: '' },
      ]),
    );
    mockGqlFetcher.mockRejectedValue(new Error('boom'));
    // Make the exponential backoff sleep instant.
    const timeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((cb: (...a: unknown[]) => void) => {
        cb();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

    await drainQueue();

    timeoutSpy.mockRestore();
    expect(getQueueLength()).toBe(0);
    expect(deadLetter()).toHaveLength(1);
  });
});

describe('ordering hardening (MOT-262)', () => {
  it('appends instead of executing inline when the queue is already non-empty', async () => {
    // Offline so the fire-and-forget drain is a no-op and we can inspect order.
    mockGetNetworkStateAsync.mockResolvedValue(OFFLINE);
    enqueue('startRide', { variables: { input: { x: 1 } } });

    await enqueueOrExecute('endRide', { variables: { input: { y: 2 } } });

    expect(mockGqlFetcher).not.toHaveBeenCalled();
    expect(queue().map((o) => o.type)).toEqual(['startRide', 'endRide']);
    expect(queue()[0].seq).toBeLessThan(queue()[1].seq);
  });

  it('delivers a back-to-back uploadWaypoints->endRide burst in order even when the upload is slow', async () => {
    const order: string[] = [];
    let releaseWp: (() => void) | undefined;
    mockGqlFetcher.mockImplementation((_doc: unknown, vars: { input: { tag: string } }) => {
      const { tag } = vars.input;
      if (tag === 'wp') {
        return new Promise<void>((resolve) => {
          releaseWp = () => {
            order.push('wp');
            resolve();
          };
        });
      }
      order.push('end');
      return Promise.resolve();
    });

    // Fire both without awaiting — mirrors the end-of-ride call sites that the
    // old inline fast-path let race (endRide could land before its waypoints).
    const p1 = enqueueOrExecute('uploadWaypoints', { variables: { input: { tag: 'wp' } } });
    const p2 = enqueueOrExecute('endRide', { variables: { input: { tag: 'end' } } });

    // Settle microtasks: endRide must be blocked behind the in-flight upload.
    await new Promise((r) => setImmediate(r));
    expect(order).toEqual([]);

    releaseWp?.();
    await Promise.all([p1, p2]);

    expect(order).toEqual(['wp', 'end']);
  });

  it('persists each delivery immediately so an interrupted drain cannot re-send delivered ops', async () => {
    enqueue('startRide', { variables: { input: {} } });
    enqueue('uploadWaypoints', { variables: { input: {} } });
    enqueue('endRide', { variables: { input: {} } });

    // startRide + uploadWaypoints deliver; endRide hangs (app killed mid-drain).
    let releaseEnd: (() => void) | undefined;
    let calls = 0;
    mockGqlFetcher.mockImplementation(() => {
      calls += 1;
      if (calls <= 2) return Promise.resolve({});
      return new Promise<void>((resolve) => {
        releaseEnd = resolve;
      });
    });

    const p = drainQueue();
    await new Promise((r) => setImmediate(r));

    // The two delivered ops must already be gone from the persisted queue —
    // only the still-in-flight endRide remains.
    expect(queue().map((o) => o.type)).toEqual(['endRide']);

    releaseEnd?.();
    await p;
    expect(getQueueLength()).toBe(0);
  });

  it('stops draining at the first transient network failure, preserving order', async () => {
    enqueue('startRide', { variables: { input: {} } });
    enqueue('uploadWaypoints', { variables: { input: {} } });
    enqueue('endRide', { variables: { input: {} } });
    mockGqlFetcher
      .mockResolvedValueOnce({}) // startRide delivers
      .mockRejectedValueOnce(new Error('Network request failed')); // uploadWaypoints fails

    await drainQueue();

    // endRide must NOT have been attempted ahead of the stuck uploadWaypoints.
    expect(mockGqlFetcher).toHaveBeenCalledTimes(2);
    expect(queue().map((o) => o.type)).toEqual(['uploadWaypoints', 'endRide']);
    // Network errors must not consume the retry budget or dead-letter.
    expect(queue()[0].retries).toBe(0);
    expect(deadLetter()).toHaveLength(0);
  });

  it('dead-letters immediately on a non-retryable GraphQL error and reports it', async () => {
    enqueue('updateRide', { variables: { input: {} } });
    mockGqlFetcher.mockRejectedValue(gqlError('FORBIDDEN'));

    await drainQueue();

    expect(getQueueLength()).toBe(0);
    expect(deadLetter()).toHaveLength(1);
    expect(mockCapture).toHaveBeenCalled();
  });

  it('notifies the dead-letter listener with the current count', async () => {
    const listener = jest.fn();
    setDeadLetterListener(listener);
    enqueue('updateRide', { variables: { input: {} } });
    mockGqlFetcher.mockRejectedValue(gqlError('BAD_USER_INPUT'));

    await drainQueue();

    expect(listener).toHaveBeenCalledWith(1);
  });
});

describe('redriveDeadLetterQueue (MOT-262)', () => {
  it('moves dead-lettered ops back to the queue (retries reset) sorted by seq', async () => {
    mockSyncStore.set(
      'sync.dead_letter',
      JSON.stringify([
        { seq: 2, type: 'endRide', payload: { variables: {} }, retries: 5, createdAt: '' },
        { seq: 1, type: 'startRide', payload: { variables: {} }, retries: 5, createdAt: '' },
      ]),
    );
    // Offline so the trailing drain is a no-op and the redriven queue is observable.
    mockGetNetworkStateAsync.mockResolvedValue(OFFLINE);

    await redriveDeadLetterQueue();

    expect(getDeadLetterCount()).toBe(0);
    expect(queue().map((o) => o.type)).toEqual(['startRide', 'endRide']);
    expect(queue().every((o) => o.retries === 0)).toBe(true);
  });
});

describe('auth errors never destroy a recorded ride (MOTO-VAULT-REACT-NATIVE-1J)', () => {
  it('does not dead-letter on UNAUTHENTICATED, no matter how many drains', async () => {
    // The production bug: UNAUTHENTICATED fell into the retryable-server-error branch,
    // burned all 5 retries in ~31s of backoff, then dead-lettered a fully recorded
    // ride. Auth outages last minutes-to-hours, so no retry budget can outlast one.
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('UNAUTHENTICATED'));

    // More drains than MAX_RETRIES (5), to prove the budget is never consumed.
    for (let i = 0; i < 8; i++) await drainQueue();

    expect(getDeadLetterCount()).toBe(0);
    expect(getQueueLength()).toBe(1);
  });

  it('leaves retries untouched so a later auth-restored drain still has full budget', async () => {
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('UNAUTHENTICATED'));
    await drainQueue();
    await drainQueue();

    expect(queue()[0].retries).toBe(0);
  });

  it('delivers the op once auth is restored', async () => {
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValueOnce(gqlError('UNAUTHENTICATED'));
    await drainQueue();
    expect(getQueueLength()).toBe(1);

    mockGqlFetcher.mockResolvedValue({});
    await drainQueue();

    expect(getQueueLength()).toBe(0);
    expect(getDeadLetterCount()).toBe(0);
  });

  it('head-of-line blocks rather than delivering a later op out of order', async () => {
    // Ordering matters: endRide reaching the server before its waypoints corrupts
    // ride reconstruction. Blocking preserves the ride; "making progress" loses it.
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    enqueue('endRide', { variables: { rideId: 'r1' } });
    mockGqlFetcher.mockRejectedValue(gqlError('UNAUTHENTICATED'));

    await drainQueue();

    expect(getQueueLength()).toBe(2);
    expect(mockGqlFetcher).toHaveBeenCalledTimes(1);
  });

  it('does not lose an auth-restored drain requested while a drain is in flight', async () => {
    // The interleave that silently stranded the queue: sign-in makes the app
    // `active` BEFORE the session lands, so the app-resume trigger starts a drain
    // that sends with a stale token. `SIGNED_IN` then fires mid-flight — under the
    // old `if (isDraining) return` it evaporated, leaving a valid session, a blocked
    // queue, and no trigger left until the ~1h token refresh.
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });

    mockGqlFetcher
      .mockImplementationOnce(async () => {
        // The SIGNED_IN trigger fires while this stale-token request is in flight.
        void drainQueue();
        throw gqlError('UNAUTHENTICATED');
      })
      .mockResolvedValue({}); // auth is good by the time the second pass runs

    await drainQueue();

    // The coalesced request drove a second pass, which delivered.
    expect(getQueueLength()).toBe(0);
    expect(getDeadLetterCount()).toBe(0);
    expect(mockGqlFetcher).toHaveBeenCalledTimes(2);
  });

  it('still dead-letters a genuinely permanent error', async () => {
    // The auth carve-out must not weaken the permanent-failure path.
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('BAD_REQUEST'));

    await drainQueue();

    expect(getDeadLetterCount()).toBe(1);
    expect(getQueueLength()).toBe(0);
  });
});

describe('pending work counts BOTH stores', () => {
  it('counts dead-lettered ops as pending', async () => {
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('BAD_REQUEST'));
    await drainQueue();

    // The old guard read getQueueLength() — 0 here — and concluded it was safe to wipe.
    expect(getQueueLength()).toBe(0);
    expect(getDeadLetterCount()).toBe(1);
    expect(getPendingCount()).toBe(1);
    expect(hasPendingSyncWork()).toBe(true);
  });

  it('clearDeliveredQueue preserves a still-QUEUED op — the guard, actually observed', async () => {
    // The other two clearDeliveredQueue tests below pass even if the
    // `if (hasPendingSyncWork()) return;` guard is deleted: the function never
    // touches DEAD_LETTER_KEY on any path, and in the "nothing pending" case the
    // drain has already emptied the queue. A surviving QUEUED op is the only
    // observable effect the guard has, so this is the one that pins it down.
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('UNAUTHENTICATED'));
    await drainQueue();
    expect(getQueueLength()).toBe(1); // auth-blocked, still queued, not dead-lettered

    clearDeliveredQueue(); // the sign-out path

    expect(getQueueLength()).toBe(1);
    expect(hasPendingSyncWork()).toBe(true);
  });

  it('clearDeliveredQueue refuses to run while anything is dead-lettered', async () => {
    // This is the data-loss fix made structural: even a caller with a wrong condition
    // cannot destroy parked rides through this function.
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('BAD_REQUEST'));
    await drainQueue();

    clearDeliveredQueue();

    expect(getDeadLetterCount()).toBe(1);
    expect(deadLetter()).toHaveLength(1);
  });

  it('clearDeliveredQueue clears the queue when nothing is pending', async () => {
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockResolvedValue({});
    await drainQueue();

    clearDeliveredQueue();

    expect(getQueueLength()).toBe(0);
    expect(hasPendingSyncWork()).toBe(false);
  });

  it('a dead-lettered ride survives and can still be redriven', async () => {
    enqueue('uploadWaypoints', { variables: { rideId: 'r1', waypoints: [] } });
    mockGqlFetcher.mockRejectedValue(gqlError('BAD_REQUEST'));
    await drainQueue();

    clearDeliveredQueue(); // the sign-out path
    mockGqlFetcher.mockReset().mockResolvedValue({});
    // Await the redrive's own drain — the promise that actually tracks delivery.
    // The drain is single-flight (`inFlight` + `drainRequested`), so a separate
    // `drainQueue()` here would just await the same cycle; asserting on that instead
    // would depend on which cycle happened to be live rather than on this redrive.
    await redriveDeadLetterQueue();

    expect(getDeadLetterCount()).toBe(0);
    expect(mockGqlFetcher).toHaveBeenCalled();
  });
});
