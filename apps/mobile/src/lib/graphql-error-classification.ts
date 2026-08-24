/**
 * Pure classification of GraphQL transport errors.
 *
 * Deliberately dependency-free. Both the fetcher (`graphql-client.ts`) and
 * Sentry's `beforeSend` (`analytics.ts`) need this logic, and `analytics.ts` is
 * imported at the very top of the root layout to call `initSentry()`. Routing it
 * through `graphql-client.ts` would pull the Supabase client (and SecureStore)
 * into that first import, so the shared pieces live here instead.
 */

/** GraphQL `extensions.code` values the NestJS API emits. */
export const GRAPHQL_ERROR_CODE = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type GraphQLErrorCode = (typeof GRAPHQL_ERROR_CODE)[keyof typeof GRAPHQL_ERROR_CODE];

/**
 * Codes that mean "the server correctly refused a user action and the app is
 * already telling the user why". Every one of these is normal product
 * behaviour — a free-tier bike limit, an off-topic article prompt, an end date
 * before a start date, a trip that is no longer joinable. They are handled by
 * the caller (alert / inline error) and are NOT crash-report material.
 *
 * They dominated two Sentry groups (MOTO-VAULT-REACT-NATIVE-1J / -1M, ~3k
 * events between them) because every `graphql-request` failure shares one
 * stacktrace (`runRequest.js` → `new ClientError`), so unrelated business
 * rejections collapsed into one group whose title was whichever message
 * happened to arrive first.
 *
 * Genuine failures stay reported: UNAUTHENTICATED (a real auth bug once a
 * session exists), FORBIDDEN (an authorization anomaly — the client should not
 * have offered the action), SERVICE_UNAVAILABLE, INTERNAL_SERVER_ERROR, and
 * anything without a recognised code.
 */
const EXPECTED_BUSINESS_RULE_CODES: readonly string[] = [
  GRAPHQL_ERROR_CODE.BAD_REQUEST,
  GRAPHQL_ERROR_CODE.BAD_USER_INPUT,
  GRAPHQL_ERROR_CODE.NOT_FOUND,
  GRAPHQL_ERROR_CODE.CONFLICT,
  GRAPHQL_ERROR_CODE.TOO_MANY_REQUESTS,
];

export function isExpectedBusinessRuleCode(code: string | undefined): boolean {
  return code !== undefined && EXPECTED_BUSINESS_RULE_CODES.includes(code);
}

/**
 * The `source` values stamped by TanStack Query's GLOBAL error handlers in
 * `query-client.ts`. Reaching one of these means the app fell through to
 * `Alert.alert('Error', userFriendlyError(error))` — the user has already been
 * told, so a business-rule rejection there is a handled outcome, not a report.
 *
 * Every other capture site opted in deliberately (a feature-specific catch, or
 * `ride-sync-queue.moveToDeadLetter`, where a rejected op means silent data
 * loss), so those keep their signal even for an "expected" code.
 */
export const HANDLED_GRAPHQL_CAPTURE_SOURCE = {
  QUERY_CACHE: 'queryCache.onError',
  MUTATION_CACHE: 'mutationCache.onError',
} as const;

const HANDLED_CAPTURE_SOURCES: readonly string[] = Object.values(HANDLED_GRAPHQL_CAPTURE_SOURCE);

export function isHandledGraphQLCaptureSource(source: unknown): boolean {
  return typeof source === 'string' && HANDLED_CAPTURE_SOURCES.includes(source);
}

/**
 * Message carried by `MissingGqlSessionError`. Stable so `beforeSend` can drop
 * the event even when the original exception is unavailable (only the
 * serialized event reaches some transport paths).
 */
export const MISSING_GQL_SESSION_MESSAGE = 'No authenticated session for GraphQL request';

/**
 * Thrown by `gqlFetcher` when the API rejected a request as UNAUTHENTICATED and
 * a session refresh could not produce a token — i.e. nobody is signed in. The
 * request is not retried: without a token the retry is guaranteed to fail the
 * same way, which is exactly the loop that produced MOTO-VAULT-REACT-NATIVE-1J.
 *
 * Shaped like a `graphql-request` ClientError (`response.errors[0].extensions.
 * code = UNAUTHENTICATED`) on purpose, so every existing consumer keeps working
 * unchanged: `hasGraphQLCode(error, 'UNAUTHENTICATED')` in `query-client.ts`
 * still suppresses the alert, and `userFriendlyError` still resolves the
 * "session has expired" copy.
 */
export class MissingGqlSessionError extends Error {
  readonly isMissingGqlSession = true;
  readonly response: {
    data: null;
    errors: { message: string; extensions: { code: GraphQLErrorCode } }[];
  };

  constructor(operationName?: string) {
    super(
      operationName
        ? `${MISSING_GQL_SESSION_MESSAGE} (${operationName})`
        : MISSING_GQL_SESSION_MESSAGE,
    );
    this.name = 'MissingGqlSessionError';
    this.response = {
      data: null,
      errors: [
        {
          message: MISSING_GQL_SESSION_MESSAGE,
          extensions: { code: GRAPHQL_ERROR_CODE.UNAUTHENTICATED },
        },
      ],
    };
  }
}

export function isMissingGqlSessionError(error: unknown): boolean {
  if (error instanceof MissingGqlSessionError) return true;
  if (error && typeof error === 'object' && 'isMissingGqlSession' in error) {
    return (error as { isMissingGqlSession?: unknown }).isMissingGqlSession === true;
  }
  return false;
}

/** What we can learn about a failed GraphQL request, for filtering + grouping. */
export interface GraphQLErrorDescriptor {
  /** `extensions.code` of the first GraphQL error, when present. */
  code?: string;
  /** The server's message for the first GraphQL error. */
  message: string;
  /** Dotted `path` of the first GraphQL error (the field that failed). */
  path?: string;
  /** Operation name parsed out of the request document. */
  operationName?: string;
}

type RawGqlError = {
  message?: unknown;
  path?: unknown;
  extensions?: { code?: unknown };
};

const OPERATION_NAME_PATTERN = /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/;

function parseOperationName(query: unknown): string | undefined {
  if (typeof query !== 'string') return undefined;
  return OPERATION_NAME_PATTERN.exec(query)?.[1];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

/**
 * Read the GraphQL shape off a thrown error. Returns null for anything that is
 * not a GraphQL response failure (network errors, JS bugs, native crashes).
 */
export function describeGraphQLError(error: unknown): GraphQLErrorDescriptor | null {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  const errors = response?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;

  const first = errors[0] as RawGqlError;
  const path = Array.isArray(first.path) ? first.path.join('.') : undefined;
  return {
    code: typeof first.extensions?.code === 'string' ? first.extensions.code : undefined,
    message: typeof first.message === 'string' ? first.message : '',
    path,
    operationName: parseOperationName(asRecord(record?.request)?.query),
  };
}

// `graphql-request` builds its ClientError message as
// `${firstMessage}: ${JSON.stringify({ response, request })}`, so the serialized
// Sentry value still carries both the message and the code even when the
// original exception object is not available to `beforeSend`.
const SERIALIZED_CODE_PATTERN = /"code"\s*:\s*"([A-Z_]+)"/;
const SERIALIZED_PATH_PATTERN = /"path"\s*:\s*\[\s*"([^"]+)"/;
const SERIALIZED_SUFFIX = ': {"response"';

/** Fallback for when only the serialized Sentry exception value is available. */
export function describeGraphQLErrorFromMessage(
  value: string | undefined,
): GraphQLErrorDescriptor | null {
  if (!value) return null;
  const suffixAt = value.indexOf(SERIALIZED_SUFFIX);
  if (suffixAt === -1) return null;
  return {
    code: SERIALIZED_CODE_PATTERN.exec(value)?.[1],
    message: value.slice(0, suffixAt),
    path: SERIALIZED_PATH_PATTERN.exec(value)?.[1],
    operationName: parseOperationName(value),
  };
}

/**
 * Stable Sentry fingerprint for a GraphQL failure. Without it every
 * `graphql-request` error groups on the shared `runRequest` stacktrace, so
 * unrelated server rejections land in one issue with an arbitrary title.
 * Grouping on field + code (never the message, which interpolates ids, limits
 * and user input) keeps one issue per real problem.
 */
export function graphQLFingerprint(descriptor: GraphQLErrorDescriptor): string[] {
  return [
    'graphql-client-error',
    descriptor.path ?? descriptor.operationName ?? 'unknown-operation',
    descriptor.code ?? 'no-code',
  ];
}
