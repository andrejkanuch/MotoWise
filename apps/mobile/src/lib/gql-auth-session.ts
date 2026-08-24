import type { Session } from '@supabase/supabase-js';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from './supabase';

type CachedAccess = { accessToken: string; expiresAtMs: number };

let cachedAccess: CachedAccess | null = null;

/** Call on Supabase auth state changes so we never send a stale JWT after sign-out. */
export function invalidateGqlAccessTokenCache(): void {
  cachedAccess = null;
}

// Single in-flight refresh: a burst of concurrent UNAUTHENTICATED retries (or a
// proactive near-expiry refresh) collapses to ONE supabase.auth.refreshSession()
// call instead of a stampede. Subsequent callers await the same promise.
let refreshPromise: Promise<Session | null> | null = null;

function dedupedRefresh(): Promise<Session | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const { data } = await supabase.auth.refreshSession();
      return data.session;
    } catch {
      return null;
    }
  })();
  // Clear the slot once settled so the next genuine expiry can refresh again.
  void refreshPromise.finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Refresh-and-invalidate entry point for gqlFetcher's UNAUTHENTICATED retry.
 * De-duped across concurrent callers; the next buildGqlRequestHeaders re-reads
 * the freshly-refreshed session.
 *
 * Returns whether a usable access token now exists. `false` means nobody is
 * signed in (or the refresh token is gone), so retrying the request would send
 * a second header-less request — gqlFetcher fails fast instead.
 */
export async function refreshGqlSession(): Promise<boolean> {
  invalidateGqlAccessTokenCache();
  const session = await dedupedRefresh();
  return !!session?.access_token;
}

/**
 * True when the app believes a user is signed in. Cheap and synchronous (reads
 * the auth store, not SecureStore) so background/headless code paths — CarPlay,
 * widget sync, sync-queue drains — can skip authenticated GraphQL work instead
 * of firing a request that the API can only reject.
 *
 * `isLoading` guards the cold-start window: the store's session is null until
 * `supabase.auth.getSession()` resolves in the root layout, and a request fired
 * in that gap would look "signed out" while a perfectly good session is one tick
 * away. During hydration we let the request through and rely on
 * `materializeSession` to pick the token up. (Sentry MOTO-VAULT-REACT-NATIVE-1J)
 */
export function hasAuthenticatedSession(): boolean {
  const { session, isLoading } = useAuthStore.getState();
  return !!session || isLoading;
}

async function materializeSession(): Promise<CachedAccess | null> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    // supabase.auth.getSession() returned nothing, but our app store believes a
    // session exists (e.g. right after sign-up on the onboarding "personalizing"
    // screen, or when resuming from background before Supabase has rehydrated
    // from SecureStore). Fire one de-duped refresh BEFORE the request so we don't
    // send an authenticated mutation with a missing Authorization header — the
    // top production error (MOTO-VAULT-REACT-NATIVE-1J). Gated on the store
    // session so anonymous/public browsing never pays for a doomed refresh.
    if (useAuthStore.getState().session) {
      const refreshed = await dedupedRefresh();
      if (refreshed) session = refreshed;
    }
  } else if (session.expires_at) {
    const expiresAt = session.expires_at * 1000;
    if (expiresAt - Date.now() < 60_000) {
      // Offline/transient failures resolve to null and keep the current session;
      // gqlFetcher's UNAUTHENTICATED retry handles refresh-and-retry on drain.
      const refreshed = await dedupedRefresh();
      if (refreshed) session = refreshed;
    }
  }

  if (!session?.access_token) {
    cachedAccess = null;
    return null;
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  cachedAccess = { accessToken: session.access_token, expiresAtMs };
  return cachedAccess;
}

/**
 * Headers for GraphQL: reuses the access token until ~60s before expiry to avoid
 * hitting SecureStore / getSession on every request in a burst.
 */
export async function buildGqlRequestHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  const locale = useAuthStore.getState().locale;

  if (cachedAccess && cachedAccess.expiresAtMs - now > 60_000) {
    return headersFromToken(cachedAccess.accessToken, locale);
  }

  const next = await materializeSession();
  return headersFromToken(next?.accessToken, locale);
}

function headersFromToken(token: string | undefined, locale: string): Record<string, string> {
  const headers: Record<string, string> = { 'x-locale': locale };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
