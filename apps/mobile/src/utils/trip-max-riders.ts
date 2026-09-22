import { TRIP_MAX_RIDERS } from '@motovault/types';

/**
 * Rider-count rules for the create/edit trip form.
 *
 * The bounds themselves are NOT declared here. They live in
 * `@motovault/types` (`constants/limits.ts`) because the Zod schemas and the
 * `trips_max_riders_check` constraint have to agree with them, and a second
 * declaration is how MOTO-VAULT-NODE-NESTJS-K happened: Zod accepted 1, Postgres
 * refused it, and every solo trip creation returned a 500. Re-exported so the
 * screen imports its rules from one module.
 */
export { TRIP_MAX_RIDERS };

/**
 * Why the raw field value is not usable, or `null` when it is. Returned as a
 * code rather than a string so the screen owns the copy and can translate it —
 * this module has no access to i18n.
 */
export const MAX_RIDERS_ISSUE = {
  EMPTY: 'empty',
  BELOW_MIN: 'belowMin',
  ABOVE_MAX: 'aboveMax',
} as const;

export type MaxRidersIssue = (typeof MAX_RIDERS_ISSUE)[keyof typeof MAX_RIDERS_ISSUE];

/**
 * Validate the raw text of the "Max riders" field.
 *
 * The field is free text (`keyboardType="number-pad"`, digits only), so every
 * out-of-range value below is genuinely typeable.
 */
export function validateMaxRidersInput(raw: string): MaxRidersIssue | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return MAX_RIDERS_ISSUE.EMPTY;

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return MAX_RIDERS_ISSUE.EMPTY;
  if (parsed < TRIP_MAX_RIDERS.MIN) return MAX_RIDERS_ISSUE.BELOW_MIN;
  if (parsed > TRIP_MAX_RIDERS.MAX) return MAX_RIDERS_ISSUE.ABOVE_MAX;
  return null;
}

/**
 * Coerce the raw field value into a number the API will accept.
 *
 * Replaces `Number.parseInt(raw, 10) || 10`, under which `"0"` (falsy) silently
 * became a **ten**-rider trip while the field still showed `0`, and `""` did the
 * same. Clamping is the last line of defence: the form blocks saving while
 * {@link validateMaxRidersInput} reports an issue, and the field is normalised on
 * blur, so the rider always sees the value that will be saved.
 */
export function parseMaxRiders(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(parsed)) return TRIP_MAX_RIDERS.DEFAULT;
  return Math.min(TRIP_MAX_RIDERS.MAX, Math.max(TRIP_MAX_RIDERS.MIN, parsed));
}

/**
 * The value to write back into the field on blur, so what the rider sees is what
 * gets saved. Never clamp silently — this is the visible half of that rule.
 */
export function normalizeMaxRidersInput(raw: string): string {
  return String(parseMaxRiders(raw));
}
