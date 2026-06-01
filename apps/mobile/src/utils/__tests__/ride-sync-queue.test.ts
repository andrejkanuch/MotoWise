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

import {
  clearAll,
  drainQueue,
  enqueue,
  enqueueOrExecute,
  getQueueLength,
} from '../ride-sync-queue';

const ONLINE = { isConnected: true, isInternetReachable: true };
const OFFLINE = { isConnected: false, isInternetReachable: false };

function deadLetter(): unknown[] {
  const raw = mockSyncStore.get('sync.dead_letter');
  return typeof raw === 'string' ? JSON.parse(raw) : [];
}

beforeEach(() => {
  clearAll();
  mockGqlFetcher.mockReset();
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
