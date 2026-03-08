import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';
import { useAuthStore } from '../stores/auth.store';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const client = new GraphQLClient(apiUrl);

export async function gqlFetcher<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // getSession() reads from storage and may return an expired token.
  // If expired or close to expiry (within 60s), force a refresh.
  if (session?.expires_at) {
    const expiresAt = session.expires_at * 1000; // seconds → ms
    if (expiresAt - Date.now() < 60_000) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }
  }

  const token = session?.access_token;
  const locale = useAuthStore.getState().locale;

  const headers: Record<string, string> = {
    'x-locale': locale,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return client.request<TData>({
    document,
    variables: variables as Record<string, unknown>,
    requestHeaders: headers,
  });
}
