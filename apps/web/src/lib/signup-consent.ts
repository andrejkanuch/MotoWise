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
 * `data` for the BACKGROUND sync (on sign-in / page load) that brings a
 * signed-in account's saved decision in line with the cookie banner, or null
 * when nothing should be written: no decision yet (never write null), the
 * account already matches, or — asymmetric on purpose — the banner says yes but
 * the account says no. A browser's "yes" may be stale or someone else's (shared
 * device), so it only fills a missing decision; a "no" may always overwrite a
 * "yes". A deliberate no → yes happens only on an Accept click
 * (`writeAccountConsent`). Covers a later change of mind on the banner and
 * Google/Apple sign-ins, whose OAuth flow carries no metadata.
 */
export function consentMetadataUpdate(
  consent: boolean | null,
  userMetadata: Record<string, unknown> | null | undefined,
): Record<string, boolean> | null {
  if (typeof consent !== 'boolean') return null;
  const stored = userMetadata?.[SIGNUP_CONSENT_METADATA_KEY];
  if (stored === consent) return null;
  if (consent && stored === false) return null;
  return { [SIGNUP_CONSENT_METADATA_KEY]: consent };
}
