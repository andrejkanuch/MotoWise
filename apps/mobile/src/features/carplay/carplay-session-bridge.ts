import type { Session } from '@supabase/supabase-js';
import { invalidateGqlAccessTokenCache } from '../../lib/gql-auth-session';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth.store';
import { drainQueue } from '../../utils/ride-sync-queue';

/**
 * Puts the Supabase session into the auth store for a CarPlay-only process.
 *
 * The root layout's `onAuthStateChange` listener is the only other writer of
 * `useAuthStore.session`, and a CarPlay-only cold launch (the rider starts the app
 * from the head unit, phone app not running) never mounts the root layout. With no
 * session in the store, `isOwnedByCurrentSession` refuses every queued op, so the
 * ride recorded nothing on the server until the phone UI was opened: 79 minutes of
 * waypoints drained in one burst on 2026-10-10, and a crash or reinstall before that
 * would have lost the ride.
 *
 * This listener only mirrors the session and restarts delivery. Everything else the
 * root layout does on an auth change (identify, RevenueCat, push registration,
 * sign-out cleanup) stays there and runs when the phone UI mounts. When the root
 * layout is mounted too, both listeners write the same session, which is a no-op.
 */
let unsubscribe: (() => void) | null = null;

function isSameSession(a: Session | null, b: Session | null): boolean {
  return a?.user?.id === b?.user?.id && a?.access_token === b?.access_token;
}

/** Idempotent. `onSession` runs each time a signed-in session arrives. */
export function startCarPlaySessionBridge(onSession: () => void): void {
  if (unsubscribe) return;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (isSameSession(useAuthStore.getState().session, session)) return;
    invalidateGqlAccessTokenCache();
    useAuthStore.getState().setSession(session);
    if (!session) return;
    void drainQueue();
    onSession();
  });
  unsubscribe = () => subscription.unsubscribe();
}

// Test-only reset.
export function __resetCarPlaySessionBridge(): void {
  unsubscribe?.();
  unsubscribe = null;
}
