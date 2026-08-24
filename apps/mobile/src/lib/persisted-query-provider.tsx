import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { queryClient } from './query-client';
import { queryPersister, shouldDehydratePersistedQuery } from './query-persist';
import {
  deleteSecureItem,
  getSecureItemSync,
  SECURE_STORE_KEY,
  setSecureItemSync,
} from './secure-store';

const MAX_PERSIST_AGE_MS = 1000 * 60 * 60 * 24 * 7;

// LAST_USER_ID is read during background TOKEN_REFRESHED events, when the
// device may still be locked. lib/secure-store stores it with
// AFTER_FIRST_UNLOCK so the keychain item stays readable in the background, and
// every access degrades to "no persisted user" instead of throwing an unhandled
// rejection. (Sentry MOTO-VAULT-REACT-NATIVE-21 / -2D)

export function getLastUserId(): string | null {
  return getSecureItemSync(SECURE_STORE_KEY.LAST_USER_ID);
}

export function setLastUserId(sessionUserId: string): void {
  // Best-effort: a locked keychain just means the next cold start falls back to
  // an empty buster.
  setSecureItemSync(SECURE_STORE_KEY.LAST_USER_ID, sessionUserId);
}

export function clearLastUserId(): void {
  // Best-effort cleanup; a locked keychain retries on the next sign-out.
  void deleteSecureItem(SECURE_STORE_KEY.LAST_USER_ID);
}

export function PersistedQueryClientBoundary({ children }: { children: ReactNode }) {
  const sessionUserId = useAuthStore((s) => s.session?.user?.id);
  // On cold start, session is null. Read last-known user ID synchronously
  // from SecureStore so the buster matches the persisted cache.
  const buster = sessionUserId ?? getLastUserId() ?? '';

  useEffect(() => {
    if (sessionUserId) setLastUserId(sessionUserId);
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
