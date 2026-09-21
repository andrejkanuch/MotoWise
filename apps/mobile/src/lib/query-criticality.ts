/**
 * How much the user depends on a given query's data.
 *
 * Declared per-query via `meta.criticality` and consulted by the GLOBAL
 * handlers in `query-client.ts`. Absent ⇒ CRITICAL: silence is always opt-in,
 * never a default.
 */
export const QUERY_CRITICALITY = {
  /**
   * DEFAULT. Failure blocks or degrades a real user task. Always reported to
   * Sentry, always eligible for the user-facing alert.
   */
  CRITICAL: 'critical',
  /**
   * A decorative / enhancement surface. Entry criteria — ALL must hold:
   *   1. It is a READ. Mutations NEVER qualify (a failed write is data loss).
   *   2. The consuming component already renders `null`, or skips a row,
   *      when the data is absent — verify this in the component before
   *      applying the flag.
   *   3. No money, subscription, entitlement, quota, auth or navigation
   *      decision depends on it.
   * A provider-side outage on one of these is recorded as a BREADCRUMB and
   * raises no modal. Our OWN bugs inside it are still reported in full — see
   * the downgrade rules in `query-client.ts`.
   */
  ENHANCEMENT: 'enhancement',
} as const;

export type QueryCriticality = (typeof QUERY_CRITICALITY)[keyof typeof QUERY_CRITICALITY];

/** Absent `meta.criticality` means CRITICAL. Silence is always opt-in. */
export function resolveCriticality(criticality: QueryCriticality | undefined): QueryCriticality {
  return criticality ?? QUERY_CRITICALITY.CRITICAL;
}
