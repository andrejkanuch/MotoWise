import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';
import { getSupabaseServerClient } from './supabase-server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const serverClient = new GraphQLClient(apiUrl);

/**
 * Server-side GraphQL fetcher for use in RSC / generateMetadata.
 * No auth — only call public queries with this.
 */
export async function gqlServerFetcher<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  return serverClient.request<TData>({
    document,
    variables: variables as Record<string, unknown>,
    signal: AbortSignal.timeout(8_000),
  });
}

/**
 * Authenticated server-side GraphQL fetcher for RSC. Reads the user's Supabase
 * access token from the request cookies (no network call) and forwards it as a
 * `Bearer` token so user-scoped, RLS-enforced queries resolve server-side.
 *
 * NEVER uses the service-role key — it forwards the end user's own JWT, so the
 * API's RLS author checks still apply. Callers must already sit behind an auth
 * gate (e.g. the (community) layout, which redirects unauthenticated users);
 * this throws if no session cookie is present so a missing token never silently
 * downgrades to an unauthenticated request.
 */
export async function gqlServerFetcherAuthed<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  const supabase = await getSupabaseServerClient();
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // getSession() reads the cookie-cached JWT without contacting Supabase, so an
  // expired (or nearly-expired) token would be forwarded verbatim and rejected
  // by the API — the prefetch would be swallowed and the client would refetch,
  // silently losing the no-flash SSR benefit for exactly the stale-token users.
  // Mirror the client fetcher (graphql-client.ts): refresh when within 60s of
  // expiry so the forwarded token is valid.
  if (session?.expires_at && session.expires_at * 1000 - Date.now() < 60_000) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session;
  }

  const token = session?.access_token;
  if (!token) {
    throw new Error('gqlServerFetcherAuthed: no authenticated session');
  }
  return serverClient.request<TData>({
    document,
    variables: variables as Record<string, unknown>,
    requestHeaders: { Authorization: `Bearer ${token}` },
    // Shorter than the public fetcher's 8s: the garage prefetch runs two
    // sequential levels, so a per-call cap of 5s bounds the worst-case
    // HTML-blocking wait (~10s) instead of ~16s when the API is degraded.
    signal: AbortSignal.timeout(5_000),
  });
}
