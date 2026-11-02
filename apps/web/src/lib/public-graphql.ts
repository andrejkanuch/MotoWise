/**
 * Existence lookups for statically rendered (ISR) pages.
 *
 * A page that turns "no data" into notFound() must tell a definitive "this
 * does not exist" apart from "we never got a real answer": under ISR a false
 * 404 is cached for the whole revalidate window, while a thrown error keeps
 * the last good page
 * (docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md).
 *
 * The API answers resolver failures inside an HTTP 200 body (Apollo; see
 * apps/api/src/common/filters/gql-exception.filter.ts), so the status alone
 * cannot tell them apart: the error codes decide. Only HTTP 200 with no data,
 * or with errors that are all NOT_FOUND, is "absent". Everything else throws:
 * a non-200 status (5xx, a 400 validation error from a web/API deploy skew,
 * 429), a body that is not JSON, or any other error code
 * (INTERNAL_SERVER_ERROR, SERVICE_UNAVAILABLE, a missing code…).
 */

export const GRAPHQL_NOT_FOUND_CODE = 'NOT_FOUND';
/** A resolver's BadRequestException (a malformed id or token), answered at HTTP 200. */
export const GRAPHQL_BAD_REQUEST_CODE = 'BAD_REQUEST';

const DEFAULT_ABSENT_CODES: readonly string[] = [GRAPHQL_NOT_FOUND_CODE];

/** Per-request timeout, matching the public GraphQL fetcher (lib/graphql-server.ts). */
export const PUBLIC_QUERY_TIMEOUT_MS = 8_000;

const HTTP_OK = 200;

interface GraphQLErrorShape {
  extensions?: { code?: unknown } | null;
}

interface GraphQLBody<T> {
  data?: T | null;
  errors?: GraphQLErrorShape[] | null;
}

export class PublicQueryError extends Error {
  constructor(reason: string) {
    super(`Public GraphQL query failed: ${reason}`);
    this.name = 'PublicQueryError';
  }
}

/**
 * Classifies one GraphQL response: its `data` when present, `null` when the
 * API answered definitively that the resource is absent, a thrown
 * PublicQueryError for anything that is not a real answer.
 *
 * `absentCodes` lists the error codes that mean "absent". It defaults to
 * NOT_FOUND; a query whose resolver rejects a malformed argument with
 * BAD_REQUEST can add that code so a junk URL is a 404, not an outage.
 */
export function classifyPublicResponse<T>(
  status: number,
  body: unknown,
  absentCodes: readonly string[] = DEFAULT_ABSENT_CODES,
): T | null {
  if (status !== HTTP_OK) throw new PublicQueryError(`HTTP ${status}`);
  if (body === null || typeof body !== 'object') {
    throw new PublicQueryError(`HTTP ${status}, body is not a GraphQL response`);
  }
  const { data, errors } = body as GraphQLBody<T>;
  if (Array.isArray(errors) && errors.length > 0) {
    if (errors.every((e) => absentCodes.includes(String(e?.extensions?.code)))) return null;
    const codes = errors.map((e) => String(e?.extensions?.code ?? 'no code')).join(', ');
    throw new PublicQueryError(`GraphQL errors (${codes})`);
  }
  return data ?? null;
}

/**
 * POSTs one public (unauthenticated) query and classifies the answer with
 * classifyPublicResponse. Network errors and timeouts propagate as thrown.
 */
export async function postPublicQuery<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
  revalidate: number,
  absentCodes: readonly string[] = DEFAULT_ABSENT_CODES,
): Promise<T | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
    signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS),
  });
  const body: unknown = await res.json().catch(() => {
    throw new PublicQueryError(`HTTP ${res.status}, body is not JSON`);
  });
  return classifyPublicResponse<T>(res.status, body, absentCodes);
}
