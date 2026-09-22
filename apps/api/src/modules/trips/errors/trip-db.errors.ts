import {
  BadRequestException,
  InternalServerErrorException,
  type Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * ⚠️ TEMPORARY LOCAL COPY — to be replaced by a shared module.
 *
 * `apps/api/src/modules/rides/rides.service.ts` (~L48-63) already carries an
 * identical `PG_ERROR_CLASS_DISPOSITION` / `pgDisposition` pair, added for the
 * same class of incident (MOTO-VAULT-NODE-NESTJS-8). Both symbols are
 * module-private there, and that file is owned by a concurrent change, so the
 * extraction to `apps/api/src/common/supabase/pg-disposition.ts` is deliberately
 * NOT done here. The exact proposed diff lives in the scratchpad note
 * `bug5-shared-pg-disposition.md`. When it lands, delete this block and import
 * from the shared module — do not let a second table drift.
 *
 * Postgres SQLSTATE class → whether a retry could ever succeed. Matched by class
 * prefix so every code in the class is covered.
 *
 *   transient — 08 connection exception
 *               40 transaction rollback (40001 serialization, 40P01 deadlock)
 *               53 insufficient resources (53300 too_many_connections)
 *               57 operator intervention (57014 statement_timeout)
 *   permanent — 22 data exception (22003 numeric_value_out_of_range, …)
 *               23 integrity constraint violation (23502 not-null, 23503 FK,
 *                  23514 check violation)
 *
 * Unknown classes still map to 500 — an unknown failure is worth retrying, and
 * worth alerting on.
 */
const PG_ERROR_CLASS_DISPOSITION = {
  '08': 'transient',
  '40': 'transient',
  '53': 'transient',
  '57': 'transient',
  '22': 'permanent',
  '23': 'permanent',
} as const;

export type PgDisposition =
  (typeof PG_ERROR_CLASS_DISPOSITION)[keyof typeof PG_ERROR_CLASS_DISPOSITION];

export function pgDisposition(code: string | null | undefined): PgDisposition | 'unknown' {
  if (!code) return 'unknown';
  const match = Object.entries(PG_ERROR_CLASS_DISPOSITION).find(([cls]) => code.startsWith(cls));
  return match ? match[1] : 'unknown';
}

/**
 * Postgres check-constraint violation. `PG_ERROR` in
 * `common/supabase/unwrap.ts` does not carry this code yet; that file is outside
 * this change's ownership, so it is declared here and should move there with the
 * shared-module extraction above.
 */
export const PG_CHECK_VIOLATION = '23514';

/**
 * Constraint names on `public.trips` the API translates into rider-facing copy.
 * `trips` carries ten CHECK constraints; PostgREST puts the violated name in
 * `error.message`, so branch on it rather than assuming which one fired.
 */
export const TRIP_CONSTRAINT = {
  DATE_RANGE: 'chk_trips_date_range',
  MAX_RIDERS: 'trips_max_riders_check',
} as const;

/** Unknown-code fallback for the log line and the appended status code. */
const UNKNOWN_CODE = 'unknown';

/**
 * The `cause` carried into Sentry. `AllExceptionsFilter` captures the thrown
 * exception and Sentry's LinkedErrors integration walks `cause`, so the Postgres
 * code lands on the event as a chained exception instead of living only in the
 * Render logs. `details`/`hint` deliberately stay out of it — `instrument.ts`
 * sets `sendDefaultPii: false` and PostgREST `details` can echo the offending
 * row; they belong on the log line.
 */
const toCause = (error: PostgrestError): Error =>
  new Error(`pg ${error.code ?? UNKNOWN_CODE}: ${error.message}`);

/**
 * Convert a Supabase failure on a trips write into the right HTTP status, with
 * the Postgres code attached as `cause`.
 *
 * Without this, `trip-lifecycle.service.ts` logged the code and threw a bare
 * `InternalServerErrorException`, so every failure arrived in Sentry as an
 * indistinguishable "Failed to create trip" — which is how a 23514
 * (`trips_max_riders_check`) cost a Render-log round-trip to diagnose
 * (MOTO-VAULT-NODE-NESTJS-K).
 *
 * A class-22/23 rejection is the caller's payload, not a server fault: 400, so
 * the client stops retrying a request the database will refuse every time
 * (mobile retries any non-FORBIDDEN/BAD_USER_INPUT mutation once, which turned
 * 4 taps into 8 server failures). The client-facing message stays generic — the
 * filter passes sub-500 messages through, and raw PostgREST text must not reach
 * a rider.
 */
export function throwTripDbError(
  logger: Logger,
  error: PostgrestError,
  op: string,
  message: string,
): never {
  logger.error(`${op} failed: ${error.message} (${error.code})`);
  const code = error.code ?? UNKNOWN_CODE;
  const options = { cause: toCause(error) };

  const TRIP_DB_EXCEPTIONS: Record<PgDisposition | 'unknown', () => Error> = {
    transient: () => new ServiceUnavailableException(message, options),
    permanent: () => new BadRequestException(`${message}: invalid data (${code})`, options),
    unknown: () => new InternalServerErrorException(message, options),
  };

  throw TRIP_DB_EXCEPTIONS[pgDisposition(error.code)]();
}

/**
 * `updateTrip`'s check-violation routing. The previous handler attributed every
 * 23514 to the date range, so editing a trip down to 1 rider told the rider
 * their dates were wrong. Branch on the constraint name; anything else gets a
 * neutral message rather than a confident lie.
 */
export function throwTripCheckViolation(logger: Logger, error: PostgrestError, op: string): never {
  logger.error(`${op} failed: ${error.message} (${error.code})`);
  const options = { cause: toCause(error) };

  if (error.message.includes(TRIP_CONSTRAINT.DATE_RANGE)) {
    throw new BadRequestException(
      'Invalid trip dates. The end date must be on or after the start date.',
      options,
    );
  }

  throw new BadRequestException('Some trip details are invalid.', options);
}
