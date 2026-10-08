import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  AskTripAssistantDocument,
  GenerateArticleDocument,
  GenerateBikeHealthReportDocument,
  GenerateOnboardingInsightsDocument,
  RegenerateRideSummaryDocument,
  ScanReceiptDocument,
  SubmitDiagnosticDocument,
} from '@motovault/graphql';
import { GraphQLClient } from 'graphql-request';
import { buildGqlRequestHeaders, refreshGqlSession } from './gql-auth-session';
import {
  GqlRequestTimeoutError,
  GRAPHQL_ERROR_CODE,
  MissingGqlSessionError,
} from './graphql-error-classification';
import { hasGraphQLCode } from './graphql-errors';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const client = new GraphQLClient(apiUrl);

/**
 * Client-side request timeouts. Without one, a request that never settles
 * (captive portal, half-open socket, a stalled server) holds every caller until
 * the OS network timeout — and callers that lock UI while saving (the Note and
 * Odometer sheets swallow dismissal mid-save) stay locked that long.
 */
export const GQL_TIMEOUT_MS = {
  /** Ordinary queries and mutations: plain DB reads/writes behind the API. */
  DEFAULT: 30_000,
  /**
   * LLM-backed and report-generating operations. The API's OpenAI client is
   * configured with a 60 s timeout and up to 3 retries (`AI_CLIENT` in
   * apps/api/src/config/constants.ts), so a legitimate answer can take minutes;
   * this stays above that worst case while still being bounded.
   */
  LONG_RUNNING: 300_000,
} as const;

export type GqlTimeoutMs = (typeof GQL_TIMEOUT_MS)[keyof typeof GQL_TIMEOUT_MS];

export interface GqlFetcherOptions {
  /** Overrides the timeout resolved from the document (see `LONG_RUNNING_DOCUMENTS`). */
  timeoutMs?: GqlTimeoutMs;
}

/**
 * Operations that get `GQL_TIMEOUT_MS.LONG_RUNNING` wherever they are called
 * from (hooks, offline queues, wrappers), matched by document identity — the
 * generated documents are module singletons, so no operation-name strings.
 * Callers with their own, shorter UX deadline keep it (receipt scan races
 * `ANALYZE_TIMEOUT_MS`; that race still wins).
 */
const LONG_RUNNING_DOCUMENTS: ReadonlySet<unknown> = new Set<unknown>([
  SubmitDiagnosticDocument,
  ScanReceiptDocument,
  AskTripAssistantDocument,
  GenerateArticleDocument,
  GenerateOnboardingInsightsDocument,
  GenerateBikeHealthReportDocument,
  RegenerateRideSummaryDocument,
]);

function resolveTimeoutMs(document: unknown, options?: GqlFetcherOptions): GqlTimeoutMs {
  if (options?.timeoutMs !== undefined) return options.timeoutMs;
  return LONG_RUNNING_DOCUMENTS.has(document)
    ? GQL_TIMEOUT_MS.LONG_RUNNING
    : GQL_TIMEOUT_MS.DEFAULT;
}

const OPERATION_NAME_PATTERN = /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/;

/** Operation name from a TypedDocumentNode, for error messages. */
function operationNameOf(document: unknown): string | undefined {
  const defs = (document as { definitions?: { kind?: string; name?: { value?: string } }[] })
    ?.definitions;
  const named = defs?.find((d) => d.kind === 'OperationDefinition')?.name?.value;
  if (named) return named;
  const loc = (document as { loc?: { source?: { body?: string } } })?.loc?.source?.body;
  return typeof loc === 'string' ? (OPERATION_NAME_PATTERN.exec(loc)?.[1] ?? undefined) : undefined;
}

/**
 * Run one request with a deadline. On expiry the fetch is aborted AND the
 * returned promise rejects with `GqlRequestTimeoutError` — the rejection does
 * not depend on the transport honouring the signal.
 *
 * AbortController + setTimeout rather than `AbortSignal.timeout()`: React
 * Native 0.86 installs the `abort-controller` polyfill as the global
 * AbortController/AbortSignal (Libraries/Core/setUpXHR.js) and Hermes has no
 * native one, so the static `AbortSignal.timeout` does not exist at runtime.
 */
function withTimeout<T>(
  send: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName: string | undefined,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new GqlRequestTimeoutError(timeoutMs, operationName));
      controller.abort();
    }, timeoutMs);
  });
  return Promise.race([send(controller.signal), deadline]).finally(() => clearTimeout(timer));
}

export async function gqlFetcher<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
  options?: GqlFetcherOptions,
): Promise<TData> {
  const timeoutMs = resolveTimeoutMs(document, options);
  const operationName = operationNameOf(document);

  const run = async () => {
    const requestHeaders = await buildGqlRequestHeaders();
    return withTimeout(
      (signal) =>
        client.request<TData>({
          document,
          variables: variables as Record<string, unknown>,
          requestHeaders,
          signal,
        }),
      timeoutMs,
      operationName,
    );
  };

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
      throw new MissingGqlSessionError(operationName);
    }
    return await run();
  }
}
