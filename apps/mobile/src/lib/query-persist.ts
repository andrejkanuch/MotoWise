import type { Query } from '@tanstack/react-query';
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
      return JSON.parse(raw) as PersistedClient;
    } catch {
      storage.remove(CACHE_KEY);
      return undefined;
    }
  },
  removeClient: async () => {
    storage.remove(CACHE_KEY);
  },
};

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
  // Only persist ride lists, not individual ride detail/waypoints (can be 50-100KB each)
  if (root === 'rides' && query.queryKey[1] !== 'list') return false;
  // Only persist the all-user maintenance aggregation, not per-motorcycle breakdowns
  if (root === 'maintenance-tasks' && query.queryKey[1] !== 'all-user') return false;
  return true;
}
