/**
 * The persisted query cache must never carry a mutation across a restart.
 *
 * A hydrated mutation has state but no `mutationFn`, so resuming one rejects
 * with "No mutationFn found" — reported to Sentry and alerted to the rider for
 * a write from a previous session. (Sentry MOTO-VAULT-REACT-NATIVE-3T)
 */

const mockStorage = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    remove: (key: string) => mockStorage.delete(key),
  }),
}));

import {
  type DehydratedState,
  dehydrate,
  hydrate,
  MutationCache,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import {
  queryPersister,
  shouldDehydratePersistedMutation,
  shouldDehydratePersistedQuery,
  withoutPersistedMutations,
} from '../query-persist';

const MUTATION_KEY = ['update-odometer'] as const;
const PERSISTED_QUERY_KEY = ['motorcycles', 'list'] as const;
const NO_MUTATION_FN_MESSAGE = 'No mutationFn found';

function newClient(onMutationError: (error: Error) => void = () => {}) {
  return new QueryClient({
    defaultOptions: { mutations: { networkMode: 'offlineFirst', retry: 1, retryDelay: 0 } },
    mutationCache: new MutationCache({ onError: onMutationError }),
  });
}

/** A client holding one success query and one mutation paused by going offline. */
async function clientWithPausedMutation(): Promise<QueryClient> {
  const client = newClient();
  client.setQueryData(PERSISTED_QUERY_KEY, [{ id: 'bike-1' }]);

  onlineManager.setOnline(false);
  const mutation = client.getMutationCache().build(client, {
    mutationKey: MUTATION_KEY,
    mutationFn: () => Promise.reject(new Error('Network request failed')),
  });
  // Never settles while offline; the pause is what is under test.
  void mutation.execute({ km: 12000 }).catch(() => {});
  await jest.advanceTimersByTimeAsync(10);

  expect(mutation.state.isPaused).toBe(true);
  return client;
}

/** The device comes back online; lets the resumed mutations run through their retry. */
async function resumeOnceOnline(client: QueryClient): Promise<void> {
  onlineManager.setOnline(true);
  const resumed = client.resumePausedMutations();
  await jest.advanceTimersByTimeAsync(50);
  await resumed;
}

function persistedClientFrom(clientState: DehydratedState): PersistedClient {
  return { timestamp: Date.now(), buster: 'user-1', clientState };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockStorage.clear();
  onlineManager.setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  jest.useRealTimers();
});

describe('dehydrating the cache', () => {
  it('writes no mutation, paused or not, and still writes the persisted queries', async () => {
    const client = await clientWithPausedMutation();

    const state = dehydrate(client, {
      shouldDehydrateQuery: shouldDehydratePersistedQuery,
      shouldDehydrateMutation: shouldDehydratePersistedMutation,
    });

    expect(state.mutations).toEqual([]);
    expect(state.queries.map((query) => query.queryKey)).toEqual([PERSISTED_QUERY_KEY]);
  });

  it('guards against the library default, which does write a paused mutation', async () => {
    const client = await clientWithPausedMutation();

    // If this ever stops holding the predicate above is no longer needed.
    expect(dehydrate(client).mutations).toHaveLength(1);
  });
});

describe('restoring a cache written before the fix', () => {
  it('reproduces the reported error when a persisted mutation is resumed', async () => {
    const legacyState = dehydrate(await clientWithPausedMutation());
    const errors: Error[] = [];
    const restarted = newClient((error) => errors.push(error));

    hydrate(restarted, legacyState);
    await resumeOnceOnline(restarted);

    expect(errors.map((error) => error.message)).toEqual([NO_MUTATION_FN_MESSAGE]);
  });

  it('drops the mutations on restore, so nothing is resumed and nothing errors', async () => {
    const legacyState = dehydrate(await clientWithPausedMutation());
    await queryPersister.persistClient(persistedClientFrom(legacyState));
    const errors: Error[] = [];
    const restarted = newClient((error) => errors.push(error));

    const restored = await queryPersister.restoreClient();
    if (!restored) throw new Error('expected a restored client');
    hydrate(restarted, restored.clientState);
    await resumeOnceOnline(restarted);

    expect(restored.clientState.mutations).toEqual([]);
    expect(restarted.getMutationCache().getAll()).toEqual([]);
    expect(errors).toEqual([]);
    // The queries the rider relies on offline survive the same restore.
    expect(restarted.getQueryData(PERSISTED_QUERY_KEY)).toEqual([{ id: 'bike-1' }]);
    expect(restored.buster).toBe('user-1');
  });

  it('returns a cache without mutations unchanged', () => {
    const persisted = persistedClientFrom({ mutations: [], queries: [] });

    expect(withoutPersistedMutations(persisted)).toBe(persisted);
  });

  it('still discards a corrupt cache', async () => {
    mockStorage.set('offline-cache-v1', '{not json');

    await expect(queryPersister.restoreClient()).resolves.toBeUndefined();
    expect(mockStorage.has('offline-cache-v1')).toBe(false);
  });
});
