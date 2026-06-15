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
  clearAll,
  drainQueue,
  enqueue,
  enqueueOrExecute,
  getDeadLetterCount,
  getQueueLength,
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
  clearAll();
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

  it('clearAll empties the queue and seq counter', () => {
    enqueue('endRide', { variables: {} });
    clearAll();
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
  it('moves dead-lettered ops back to the queue (retries reset) sorted by seq', () => {
    mockSyncStore.set(
      'sync.dead_letter',
      JSON.stringify([
        { seq: 2, type: 'endRide', payload: { variables: {} }, retries: 5, createdAt: '' },
        { seq: 1, type: 'startRide', payload: { variables: {} }, retries: 5, createdAt: '' },
      ]),
    );
    // Offline so the trailing drain is a no-op and the redriven queue is observable.
    mockGetNetworkStateAsync.mockResolvedValue(OFFLINE);

    redriveDeadLetterQueue();

    expect(getDeadLetterCount()).toBe(0);
    expect(queue().map((o) => o.type)).toEqual(['startRide', 'endRide']);
    expect(queue().every((o) => o.retries === 0)).toBe(true);
  });
});
