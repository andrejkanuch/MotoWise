import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';

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
