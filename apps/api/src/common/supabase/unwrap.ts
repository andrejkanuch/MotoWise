import {
  type HttpExceptionOptions,
  InternalServerErrorException,
  type Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * PostgREST / Postgres error codes the API branches on. Defined once so the
 * raw string literals (~11 `'PGRST116'` + ~9 `'23505'` sites in the audit)
 * stop being magic strings scattered across modules.
 */
export const PG_ERROR = {
  /** PostgREST "Results contain 0 rows" — emitted by `.single()` on no match. */
  NOT_FOUND: 'PGRST116',
  /** Postgres unique-violation. */
  UNIQUE_VIOLATION: '23505',
  /** Postgres foreign-key violation (e.g. ON DELETE RESTRICT blocks a delete). */
  FOREIGN_KEY_VIOLATION: '23503',
  /**
   * PostgREST: the JWT could not be decoded or is invalid. PostgREST's own
   * tutorial shows an expired token surfacing here as `"JWT expired"`.
   */
  JWT_INVALID: 'PGRST301',
  /**
   * PostgREST: the request carried no usable authentication and the anonymous
   * role is disabled (`db-anon-role` unset).
   */
  JWT_MISSING: 'PGRST302',
  /**
   * PostgREST: JWT claim validation or parsing failed — `exp` / `iat` / `nbf` /
   * `aud`. Observed in production as `"JWT issued at future"` (Sentry
   * MOTO-VAULT-NODE-NESTJS-B/C).
   */
  JWT_CLAIMS_INVALID: 'PGRST303',
} as const;

/**
 * The PostgREST codes that mean "this token is not usable", all of which
 * PostgREST itself answers with **401**. They are a client/session condition,
 * not a server fault: the caller has to obtain a fresh token and retry.
 *
 * `PGRST300` is deliberately absent. It is PostgREST's only 500 in this family
 * — the server is missing its JWT secret — which is a real config fault that
 * must keep paging.
 *
 * ⚠️ INVARIANT: every `unwrap` call site is fed by the per-request **user**
 * client (`SUPABASE_USER`), so a rejected token here is always the caller's
 * own. If you ever route a `SUPABASE_ADMIN` query through `unwrap`, do NOT let
 * it reach this branch: a refused *service-role* key is a deployment fault
 * (stale key after a JWT-secret rotation) that must page, and answering the
 * rider 401 would hide a total outage behind a pointless token refresh.
 */
const POSTGREST_AUTH_CODES: ReadonlySet<string> = new Set([
  PG_ERROR.JWT_INVALID,
  PG_ERROR.JWT_MISSING,
  PG_ERROR.JWT_CLAIMS_INVALID,
]);

/**
 * Message thrown for a rejected token. Client-visible: `AllExceptionsFilter`
 * passes messages through for sub-500 statuses. Mobile keys its refresh on the
 * `UNAUTHENTICATED` GraphQL code, never on this string.
 */
export const TOKEN_REJECTED_MESSAGE = 'Session token was rejected';

/** True when a Supabase error is PostgREST refusing the caller's JWT. */
export function isPostgrestAuthError(
  error: Pick<PostgrestError, 'code'> | null | undefined,
): boolean {
  return error != null && POSTGREST_AUTH_CODES.has(error.code);
}

/** Minimal shape of a Supabase `{ data, error }` result. */
export interface SupabaseResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Constructable exception (e.g. `BadRequestException`, `ForbiddenException`).
 * The second parameter is Nest's `HttpExceptionOptions`, which is how the
 * underlying Postgres error is attached as `cause`.
 */
type ExceptionClass = new (message?: string, options?: HttpExceptionOptions) => Error;

export interface UnwrapContext<T> {
  /** Logger of the calling service — errors are logged through it. */
  logger: Logger;
  /** Short operation label for log lines, e.g. `'getExpense'`. */
  op: string;
  /** Message thrown (and logged) when the generic error branch fires. */
  message: string;
  /**
   * When provided, a PGRST116 (0-row) result throws `NotFoundException(notFound)`
   * instead of the generic error. Without it, PGRST116 falls through to the
   * generic branch (so callers that treat 0 rows as a real error still throw).
   */
  notFound?: string;
  /**
   * When provided, a 23505 (unique-violation) result invokes this callback and
   * returns its value instead of throwing — for idempotent upserts/dedupe.
   */
  onConflict?: () => T;
  /** Exception class thrown on the generic branch. Defaults to ISE. */
  error?: ExceptionClass;
}

/**
 * Builds the `cause` carried into Sentry. `AllExceptionsFilter` captures the
 * thrown exception, and Sentry's LinkedErrors integration walks `cause`, so the
 * PostgREST code lands on the event as a chained exception instead of being
 * visible only in the Render logs. Grouping is unaffected — Sentry groups on the
 * top-level exception, so no existing issue splits.
 *
 * `details` and `hint` deliberately do NOT go here. LinkedErrors walks a chain of
 * **Errors**, so hanging a plain `{ details, hint }` object off this Error's own
 * `cause` terminates the chain and serializes nowhere — the two most diagnostic
 * PostgREST fields would be collected and silently dropped. They belong on the log
 * line instead (see `pgDetail`), which is also the safer home: `instrument.ts` sets
 * `sendDefaultPii: false`, and PostgREST `details` can echo the offending row.
 */
const toCause = (error: PostgrestError): Error => new Error(`${error.code}: ${error.message}`);

/**
 * Renders `details`/`hint` for a log line, omitting whichever PostgREST left empty
 * (both are frequently `''` or null, and ` details=null` in every log line is noise
 * that trains you to stop reading the tail). Returns `''` when neither is present.
 */
const pgDetail = (error: PostgrestError): string => {
  const parts = [
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
};

/**
 * Unwraps a Supabase `{ data, error }` result, mapping known Postgres error
 * codes to the right behaviour and logging + throwing on everything else.
 *
 * - PGRST116 + `notFound` → `NotFoundException(notFound)`
 * - 23505 + `onConflict` → returns `onConflict()` (no throw)
 * - PGRST301/302/303 → `UnauthorizedException` (see {@link POSTGREST_AUTH_CODES});
 *   logged at **warn**, and `ctx.error` is deliberately ignored
 * - any other error → logs `[op] message: <db message> (<code>)` and throws
 *   `ctx.error` (default `InternalServerErrorException`)
 * - success → returns `data`
 *
 * Every thrown exception carries the Postgres error as `cause`. Both log lines
 * append ` [details=…, hint=…]` when PostgREST supplied either.
 */
export function unwrap<T>(result: SupabaseResult<T>, ctx: UnwrapContext<T>): T {
  const { error } = result;

  if (error) {
    if (ctx.notFound !== undefined && error.code === PG_ERROR.NOT_FOUND) {
      throw new NotFoundException(ctx.notFound, { cause: toCause(error) });
    }

    if (ctx.onConflict !== undefined && error.code === PG_ERROR.UNIQUE_VIOLATION) {
      return ctx.onConflict();
    }

    // A refused token is normal traffic (a stale session, or clock skew beyond
    // PostgREST's 30s leeway on `iat`/`exp`/`nbf`). Mapping it to 401 makes the
    // filter answer `UNAUTHENTICATED`, which is what mobile's gqlFetcher keys its
    // de-duped refresh-and-retry on — and it keeps a self-healing condition out of
    // Sentry, since the filter only captures 5xx. `ctx.error` is ignored on this
    // branch: a caller asking for `BadRequestException` cannot know the token is
    // the problem, and answering 400 would strand the client without a refresh.
    if (isPostgrestAuthError(error)) {
      ctx.logger.warn(
        `[${ctx.op}] token rejected by PostgREST: ${error.message} (${error.code})${pgDetail(error)}`,
      );
      throw new UnauthorizedException(TOKEN_REJECTED_MESSAGE, { cause: toCause(error) });
    }

    ctx.logger.error(
      `[${ctx.op}] ${ctx.message}: ${error.message} (${error.code})${pgDetail(error)}`,
    );
    const ExceptionCtor = ctx.error ?? InternalServerErrorException;
    throw new ExceptionCtor(ctx.message, { cause: toCause(error) });
  }

  return result.data as T;
}
