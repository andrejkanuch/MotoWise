import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { queryClient } from './query-client';
import { queryPersister, shouldDehydratePersistedQuery } from './query-persist';

const MAX_PERSIST_AGE_MS = 1000 * 60 * 60 * 24 * 7;
export const LAST_USER_KEY = 'motovault.last-user-id';

export function PersistedQueryClientBoundary({ children }: { children: ReactNode }) {
  const sessionUserId = useAuthStore((s) => s.session?.user?.id);
  // On cold start, session is null. Read last-known user ID synchronously
  // from SecureStore so the buster matches the persisted cache.
  const buster = sessionUserId ?? SecureStore.getItem(LAST_USER_KEY) ?? '';

  useEffect(() => {
    if (sessionUserId) SecureStore.setItem(LAST_USER_KEY, sessionUserId);
  }, [sessionUserId]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: MAX_PERSIST_AGE_MS,
        buster,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydratePersistedQuery,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
