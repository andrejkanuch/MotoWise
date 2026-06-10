import * as SecureStore from 'expo-secure-store';

// -------------------------------------------------------------------
// Analytics consent persistence
// -------------------------------------------------------------------
// The user's Analytics privacy choice is authoritative for whether the
// PostHog session-replay recorder may run. That choice is resolved from the
// server `me` query AFTER login (_layout.tsx), which means it is unknown
// during the cold-start / login / onboarding window.
//
// To avoid recording before consent is known (a GDPR violation — see
// todo 184), we persist the last-known consent locally in SecureStore and
// read it synchronously at module load, so the recorder can be gated before
// it ever has a chance to start.
// -------------------------------------------------------------------

/** SecureStore key holding the last-known analytics consent ("true"/"false"). */
export const ANALYTICS_CONSENT_KEY = 'motovault.analytics-consent';

/**
 * Read the last-known analytics consent synchronously.
 *
 * Returns `false` when no value has ever been persisted — i.e. consent is
 * treated as NOT given until the user (or a synced server preference) confirms
 * it. This is the conservative default that keeps session replay off during
 * the pre-consent window for new/EU users.
 */
export function getStoredAnalyticsConsent(): boolean {
  return SecureStore.getItem(ANALYTICS_CONSENT_KEY) === 'true';
}

/** Persist the analytics consent so it can be applied on the next cold start. */
export function setStoredAnalyticsConsent(enabled: boolean): void {
  SecureStore.setItem(ANALYTICS_CONSENT_KEY, enabled ? 'true' : 'false');
}
