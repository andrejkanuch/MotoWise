import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';
import { buildGqlRequestHeaders, refreshGqlSession } from './gql-auth-session';
import { GRAPHQL_ERROR_CODE, MissingGqlSessionError } from './graphql-error-classification';
import { hasGraphQLCode } from './graphql-errors';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const client = new GraphQLClient(apiUrl);

const OPERATION_NAME_PATTERN = /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/;

/** Operation name from a TypedDocumentNode, for the no-session error message. */
function operationNameOf(document: unknown): string | undefined {
  const defs = (document as { definitions?: { kind?: string; name?: { value?: string } }[] })
    ?.definitions;
  const named = defs?.find((d) => d.kind === 'OperationDefinition')?.name?.value;
  if (named) return named;
  const loc = (document as { loc?: { source?: { body?: string } } })?.loc?.source?.body;
  return typeof loc === 'string' ? (OPERATION_NAME_PATTERN.exec(loc)?.[1] ?? undefined) : undefined;
}

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
    if (!hasGraphQLCode(error, GRAPHQL_ERROR_CODE.UNAUTHENTICATED)) throw error;

    // Single de-duped refresh across concurrent callers. `refreshGqlSession`
    // reports whether a usable access token now exists.
    const hasSession = await refreshGqlSession();
    if (!hasSession) {
      // Nobody is signed in (or the refresh token is gone). Retrying would send
      // a second header-less request and collect a second identical
      // "Missing authorization header" from the API — that retry loop is what
      // produced ~2.7k events on MOTO-VAULT-REACT-NATIVE-1J from background
      // paths (CarPlay heads-up load, ride-sync drains) firing while signed out
      // or before the session had hydrated from SecureStore.
      throw new MissingGqlSessionError(operationNameOf(document));
    }
    return await run();
  }
}
