import { InternalServerErrorException, type Logger, NotFoundException } from '@nestjs/common';
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
} as const;

/** Minimal shape of a Supabase `{ data, error }` result. */
export interface SupabaseResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Constructable exception (e.g. `BadRequestException`, `ForbiddenException`). */
type ExceptionClass = new (message?: string) => Error;

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
 * Unwraps a Supabase `{ data, error }` result, mapping known Postgres error
 * codes to the right behaviour and logging + throwing on everything else.
 *
 * - PGRST116 + `notFound` → `NotFoundException(notFound)`
 * - 23505 + `onConflict` → returns `onConflict()` (no throw)
 * - any other error → logs `[op] message: <db message>` and throws `error`
 *   (default `InternalServerErrorException`)
 * - success → returns `data`
 */
export function unwrap<T>(result: SupabaseResult<T>, ctx: UnwrapContext<T>): T {
  const { error } = result;

  if (error) {
    if (ctx.notFound !== undefined && error.code === PG_ERROR.NOT_FOUND) {
      throw new NotFoundException(ctx.notFound);
    }

    if (ctx.onConflict !== undefined && error.code === PG_ERROR.UNIQUE_VIOLATION) {
      return ctx.onConflict();
    }

    ctx.logger.error(`[${ctx.op}] ${ctx.message}: ${error.message}`);
    const ExceptionCtor = ctx.error ?? InternalServerErrorException;
    throw new ExceptionCtor(ctx.message);
  }

  return result.data as T;
}
