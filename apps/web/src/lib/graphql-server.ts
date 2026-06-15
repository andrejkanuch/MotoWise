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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('gqlServerFetcherAuthed: no authenticated session');
  }
  return serverClient.request<TData>({
    document,
    variables: variables as Record<string, unknown>,
    requestHeaders: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });
}
