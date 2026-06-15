import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';
import { buildGqlRequestHeaders, refreshGqlSession } from './gql-auth-session';
import { hasGraphQLCode } from './graphql-errors';

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
      // Single de-duped refresh across concurrent callers, then retry once.
      await refreshGqlSession();
      return await run();
    }
    throw error;
  }
}
