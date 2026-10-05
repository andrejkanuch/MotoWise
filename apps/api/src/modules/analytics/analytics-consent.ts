/**
 * The rider's analytics decision as the server sees it: a saved boolean, or
 * NULL when no decision exists anywhere.
 */
export type AnalyticsDecision = boolean | null;

/**
 * A saved "no" is never identified. NULL (no decision saved) still counts as
 * consent for now: no app before 3.21.0 saves a decision, so treating NULL as
 * "no" would make almost every rider anonymous until 3.21.0 is adopted. From
 * 3.21.0 the app saves the rider's decision on the first signed-in load and the
 * signup sweep waits 10 minutes for it (00183), so an EU rider's "no" lands first.
 * TODO: once nearly all signups come from >= 3.21.0, require an explicit TRUE.
 *
 * The one consent rule for every server-side PostHog emission (signup sweep,
 * RevenueCat webhook). Change it here, not at a call site.
 */
export function hasAnalyticsConsent(decision: AnalyticsDecision): boolean {
  return decision !== false;
}

/**
 * Resolve the decision from the two places it is saved, in the order 00184's
 * `claim_pending_signup_events` reads them:
 *   1. `users.preferences.privacy.analyticsEnabled` (the account's decision),
 *   2. `auth.users.raw_user_meta_data.analytics_consent` (sent with sign-up),
 *   3. NULL.
 * Only a real boolean counts; any other value is "no decision", as in SQL.
 */
export function readAnalyticsDecision(
  preferences: unknown,
  signupMetadata: unknown,
): AnalyticsDecision {
  const account = pick(pick(preferences, 'privacy'), 'analyticsEnabled');
  if (typeof account === 'boolean') return account;
  const atSignup = pick(signupMetadata, 'analytics_consent');
  if (typeof atSignup === 'boolean') return atSignup;
  return null;
}

/**
 * Properties that turn an event for a rider who declined into a tally rather
 * than a profile. Pair with a constant, non-identifying `distinct_id`.
 */
export const NO_CONSENT_PROPERTIES = {
  $process_person_profile: false,
  analytics_consent: false,
} as const;

function pick(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
