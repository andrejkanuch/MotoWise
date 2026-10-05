/**
 * Sign-up metadata key carrying the visitor's cookie-banner decision to the
 * server. MUST stay "analytics_consent": migration 00184 and the API's
 * `readAnalyticsDecision` read it when the account has no saved decision (the
 * same key the mobile app sends).
 */
export const SIGNUP_CONSENT_METADATA_KEY = 'analytics_consent';

/**
 * `options` to pass to `supabase.auth.signUp`: the explicit decision, if any.
 * No decision yet (banner not answered) sends nothing, so the server keeps
 * treating it as "no decision" rather than as a guess.
 */
export function signUpConsentOptions(
  consent: boolean | null,
): { data: Record<string, boolean> } | undefined {
  return typeof consent === 'boolean'
    ? { data: { [SIGNUP_CONSENT_METADATA_KEY]: consent } }
    : undefined;
}

/**
 * `data` for `supabase.auth.updateUser` that brings a signed-in account's saved
 * decision in line with the cookie banner, or null when nothing should be
 * written: no decision yet (never write null), or the account already matches.
 * Covers what sign-up metadata alone cannot: a later change of mind on the
 * banner, and Google/Apple sign-ins, whose OAuth flow carries no metadata.
 */
export function consentMetadataUpdate(
  consent: boolean | null,
  userMetadata: Record<string, unknown> | null | undefined,
): Record<string, boolean> | null {
  if (typeof consent !== 'boolean') return null;
  if (userMetadata?.[SIGNUP_CONSENT_METADATA_KEY] === consent) return null;
  return { [SIGNUP_CONSENT_METADATA_KEY]: consent };
}
