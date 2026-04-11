import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';
import { buildGqlRequestHeaders, invalidateGqlAccessTokenCache } from './gql-auth-session';
import { hasGraphQLCode } from './graphql-errors';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const client = new GraphQLClient(apiUrl);

export async function gqlFetcher<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  const run = async () =>
    client.request<TData>({
      document,
      variables: variables as Record<string, unknown>,
      requestHeaders: await buildGqlRequestHeaders(),
    });

  try {
    return await run();
  } catch (error) {
    if (hasGraphQLCode(error, 'UNAUTHENTICATED')) {
      invalidateGqlAccessTokenCache();
      await supabase.auth.refreshSession();
      return await run();
    }
    throw error;
  }
}
