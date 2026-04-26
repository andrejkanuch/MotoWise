import { useAuthStore } from '../stores/auth.store';
import { supabase } from './supabase';

type CachedAccess = { accessToken: string; expiresAtMs: number };

let cachedAccess: CachedAccess | null = null;

/** Call on Supabase auth state changes so we never send a stale JWT after sign-out. */
export function invalidateGqlAccessTokenCache(): void {
  cachedAccess = null;
}

async function materializeSession(): Promise<CachedAccess | null> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.expires_at) {
    const expiresAt = session.expires_at * 1000;
    if (expiresAt - Date.now() < 60_000) {
      try {
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
      } catch {
        // Offline or transient failure — keep using current session.
        // The token may be expired, but gqlFetcher's UNAUTHENTICATED
        // retry in graphql-client.ts handles refresh-and-retry on drain.
      }
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
