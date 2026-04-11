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

/** Only low-sensitivity reference / editorial data (RLS still applies on refetch). */
export function shouldDehydratePersistedQuery(query: Query): boolean {
  const root = query.queryKey[0];
  return root === 'nhtsa' || root === 'articles';
}
