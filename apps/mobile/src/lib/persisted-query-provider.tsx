import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { queryClient } from './query-client';
import { queryPersister, shouldDehydratePersistedQuery } from './query-persist';

const MAX_PERSIST_AGE_MS = 1000 * 60 * 60 * 24 * 7;
export const LAST_USER_KEY = 'motovault.last-user-id';

// LAST_USER_KEY is read during background TOKEN_REFRESHED events, when the
// device may still be locked. Persist it with AFTER_FIRST_UNLOCK so the
// keychain item stays readable in the background, and guard every access so a
// locked keychain (or the pre-first-unlock window after a reboot) degrades to
// "no persisted user" instead of throwing an unhandled rejection.
// (Sentry MOTO-VAULT-REACT-NATIVE-21)
const LAST_USER_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export function getLastUserId(): string | null {
  try {
    return SecureStore.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function setLastUserId(sessionUserId: string): void {
  try {
    SecureStore.setItem(LAST_USER_KEY, sessionUserId, LAST_USER_OPTIONS);
  } catch {
    // Best-effort: a locked keychain just means the next cold start falls back
    // to an empty buster.
  }
}

export function clearLastUserId(): void {
  SecureStore.deleteItemAsync(LAST_USER_KEY).catch(() => {
    // Best-effort cleanup; a locked keychain retries on the next sign-out.
  });
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
