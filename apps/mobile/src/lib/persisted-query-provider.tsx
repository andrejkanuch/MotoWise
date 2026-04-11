import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { queryClient } from './query-client';
import { queryPersister, shouldDehydratePersistedQuery } from './query-persist';

const MAX_PERSIST_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function PersistedQueryClientBoundary({ children }: { children: ReactNode }) {
  const buster = useAuthStore((s) => s.session?.user?.id ?? '');
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
