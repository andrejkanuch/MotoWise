import type { Mutation, Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'tanstack-query-persist' });
const CACHE_KEY = 'offline-cache-v1';

export const queryPersister: Persister = {
  persistClient: async (persistedClient) => {
    storage.set(CACHE_KEY, JSON.stringify(persistedClient));
  },
  restoreClient: async (): Promise<PersistedClient | undefined> => {
    const raw = storage.getString(CACHE_KEY);
    if (!raw) return undefined;
    try {
      return withoutPersistedMutations(JSON.parse(raw) as PersistedClient);
    } catch {
      storage.remove(CACHE_KEY);
      return undefined;
    }
  },
  removeClient: async () => {
    storage.remove(CACHE_KEY);
  },
};

/**
 * Mutations are never persisted, and never restored.
 *
 * TanStack Query dehydrates every PAUSED mutation by default
 * (`defaultShouldDehydrateMutation`), and mutations here run `offlineFirst`, so
 * a write made offline was paused, written to MMKV and hydrated on the next
 * launch. A hydrated mutation is state only — its `mutationFn` lived in the
 * component that created it — so the moment the device came back online
 * `resumePausedMutations` rejected it with "No mutationFn found", which the
 * global handler reported and showed the rider as an error alert for an action
 * from a previous session. The write was never replayed either way.
 * (Sentry MOTO-VAULT-REACT-NATIVE-3T)
 *
 * Replaying writes across a restart needs `setMutationDefaults` per
 * `mutationKey` plus the cache updates each call site does in `onSuccess`; no
 * mutation is set up for that. A paused mutation still resumes while the app
 * stays alive — only the cross-restart copy goes.
 */
export function shouldDehydratePersistedMutation(_mutation: Mutation): boolean {
  return false;
}

/**
 * Drops the mutations from a restored cache. `shouldDehydratePersistedMutation`
 * stops new ones being written; this covers the caches written before it, which
 * live for up to the persister's `maxAge`.
 */
export function withoutPersistedMutations(persistedClient: PersistedClient): PersistedClient {
  if (!persistedClient.clientState?.mutations?.length) return persistedClient;
  return {
    ...persistedClient,
    clientState: { ...persistedClient.clientState, mutations: [] },
  };
}

export function clearPersistedQueryCache(): void {
  storage.remove(CACHE_KEY);
}

/** Roots safe for offline persistence. RLS still applies on live refetch. */
const PERSISTED_ROOTS = new Set([
  'nhtsa', // public reference data
  'articles', // editorial content
  'motorcycles', // user's bike list
  'user', // display name + preferences
  'maintenance-tasks', // service schedule
  'rides', // recent ride list
]);

export function shouldDehydratePersistedQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const root = query.queryKey[0];
  if (typeof root !== 'string' || !PERSISTED_ROOTS.has(root)) return false;
  // Only persist ride lists + overview, not individual ride detail/waypoints (can be 50-100KB each)
  if (root === 'rides' && query.queryKey[1] !== 'list' && query.queryKey[1] !== 'overview')
    return false;
  // Only persist the all-user maintenance aggregation, not per-motorcycle breakdowns
  if (root === 'maintenance-tasks' && query.queryKey[1] !== 'all-user') return false;
  return true;
}
