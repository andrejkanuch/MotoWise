import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient } from 'graphql-request';
import { getSupabaseServerClient } from './supabase-server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const serverClient = new GraphQLClient(apiUrl);

/** Per-attempt timeout for the public fetcher. */
const PUBLIC_FETCH_TIMEOUT_MS = 8_000;
/** Total attempts (1 initial + retries) for transient API failures. */
const PUBLIC_FETCH_ATTEMPTS = 3;
/** Base backoff between attempts; grows linearly per attempt. */
const PUBLIC_FETCH_BACKOFF_MS = 750;

/**
 * The API runs on Render (motowise.onrender.com). A spun-down instance or a
 * rolling deploy leaves a window where requests time out or return 502/503/504
 * for a few seconds while the new instance boots. Before this guard, a single
 * such request 500'd the whole public page (Sentry MOTOVAULT-WEB-N: 107
 * TimeoutErrors on /explore/[country] in one ~1-minute burst). These failures
 * are transient and idempotent for public reads, so a bounded retry absorbs the
 * boot window instead of surfacing it to crawlers and users.
 */
function isRetryableApiError(err: unknown): boolean {
  if (err instanceof Error) {
    // AbortSignal.timeout() rejects with a DOMException named 'TimeoutError';
    // a manual abort uses 'AbortError'.
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
    // undici/fetch transport failures (instance not yet accepting connections).
    const msg = err.message;
    if (
      msg.includes('fetch failed') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('socket hang up')
    ) {
      return true;
    }
  }
  // graphql-request throws ClientError carrying the HTTP status. Gateway/boot
  // statuses are retryable; 4xx and GraphQL-level errors (status 200) are not.
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 502 || status === 503 || status === 504;
}

/**
 * True when a thrown fetch error is a *definitive* GraphQL application error —
 * the API executed the query and returned a non-empty `errors` array at HTTP 200,
 * e.g. a resolver throwing `NotFoundException`. This distinguishes "the API told
 * us this resource is absent" from "we never reached a definitive answer"
 * (timeouts, network failures, and 4xx/5xx — including a gateway/5xx that happens
 * to carry an errors-shaped body — see {@link isRetryableApiError}).
 *
 * The HTTP-200 guard matters: Apollo returns execution errors (a thrown resolver
 * exception) at 200, whereas request/transport failures use 4xx/5xx. Treating a
 * non-200 errors payload as "definitive" would let an infra blip short-circuit to
 * a 404. So we require status 200 explicitly.
 *
 * Callers that translate a null/absent result into `notFound()` MUST re-throw
 * when this returns `false`, so a transient API blip is never served (or, under
 * ISR, cached) as a real 404 and never emits a misleading soft-404.
 */
export function isDefinitiveGraphQLError(err: unknown): boolean {
  const response = (err as { response?: { status?: number; errors?: unknown } })?.response;
  if (response?.status !== 200) return false;
  return Array.isArray(response.errors) && response.errors.length > 0;
}

/**
 * Resolve to `absent` on a definitive not-found, re-throw anything else.
 *
 * The safe replacement for `promise.catch(() => absent)` in any existence check
 * that feeds `notFound()`. A blanket catch cannot tell "this resource does not
 * exist" from "we never got an answer", so a single API blip becomes a 404 — and
 * on a statically rendered route that 404 is *cached*, hiding real content for a
 * full revalidate window and emitting a misleading soft-404 report. Re-throwing
 * makes Next render an (uncached, retried) error instead, which is recoverable.
 *
 * Only use it for inputs that decide existence. Presentation-only fetches should
 * degrade with a plain `.catch()` so they cannot fail the page.
 *
 * @see isDefinitiveGraphQLError
 */
export async function definitiveOrThrow<T, TAbsent>(
  promise: Promise<T>,
  absent: TAbsent,
): Promise<T | TAbsent> {
  try {
    return await promise;
  } catch (err) {
    if (!isDefinitiveGraphQLError(err)) throw err;
    return absent;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Server-side GraphQL fetcher for use in RSC / generateMetadata.
 * No auth — only call public queries with this.
 *
 * Retries transient API failures (cold-start / deploy windows) up to
 * {@link PUBLIC_FETCH_ATTEMPTS} times with linear backoff. Non-transient errors
 * (4xx, GraphQL validation errors) throw immediately without retrying.
 */
export async function gqlServerFetcher<TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PUBLIC_FETCH_ATTEMPTS; attempt++) {
    try {
      return await serverClient.request<TData>({
        document,
        variables: variables as Record<string, unknown>,
        signal: AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err;
      if (attempt === PUBLIC_FETCH_ATTEMPTS || !isRetryableApiError(err)) throw err;
      await sleep(PUBLIC_FETCH_BACKOFF_MS * attempt);
    }
  }
  // Unreachable — the loop either returns or throws — but satisfies the type checker.
  throw lastError;
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
