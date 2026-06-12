import { z } from 'zod';

/**
 * `.optional()` that also tolerates an explicit `null`, normalizing it to
 * `undefined`.
 *
 * GraphQL `nullable: true` args/inputs deliver an unset value as an explicit
 * `null` (generated clients thread a declared-but-unused `$var` through as
 * null). A bare `.optional()` accepts `undefined` but REJECTS `null` —
 * "Expected string, received null" — so those requests 400 even though the
 * field is genuinely absent.
 *
 * Wrapping keeps the inferred type `T | undefined` (downstream code is
 * unchanged) and treats `null` exactly like an omitted value. Use this ONLY
 * where `null` should mean "not provided". For fields where `null` is
 * meaningful — i.e. it CLEARS a column — keep `.nullable().optional()` instead,
 * so the null reaches the service.
 */
export function nullishToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .nullable()
    .optional()
    .transform((v): z.output<T> | undefined => v ?? undefined);
}
