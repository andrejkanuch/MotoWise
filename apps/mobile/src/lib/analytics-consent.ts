import { getSecureItemSync, SECURE_STORE_KEY, setSecureItemSync } from './secure-store';

// -------------------------------------------------------------------
// Analytics consent persistence
// -------------------------------------------------------------------
// The user's Analytics privacy choice is authoritative for whether the
// PostHog session-replay recorder may run. That choice is resolved from the
// server `me` query AFTER login (_layout.tsx), which means it is unknown
// during the cold-start / login / onboarding window.
//
// To avoid recording before consent is known (a GDPR violation — see
// todo 184), we persist the last-known consent locally in the keychain and
// read it synchronously at module load, so the recorder can be gated before
// it ever has a chance to start.
//
// Reads go through lib/secure-store, so a locked device (this runs at module
// load, which on a background launch happens with the screen locked) yields
// the conservative `false` instead of throwing — same answer as "never
// persisted". See MOTO-VAULT-REACT-NATIVE-2D.
// -------------------------------------------------------------------

/** Keychain key holding the last-known analytics consent. */
export const ANALYTICS_CONSENT_KEY = SECURE_STORE_KEY.ANALYTICS_CONSENT;

/** The two persisted consent values. */
const CONSENT_VALUE = {
  GRANTED: 'true',
  DENIED: 'false',
} as const;

/**
 * Read the last-known analytics consent synchronously.
 *
 * Returns `false` when no value has ever been persisted — i.e. consent is
 * treated as NOT given until the user (or a synced server preference) confirms
 * it. This is the conservative default that keeps session replay off during
 * the pre-consent window for new/EU users, and it is also what an unreadable
 * (locked) keychain resolves to.
 */
export function getStoredAnalyticsConsent(): boolean {
  return getSecureItemSync(ANALYTICS_CONSENT_KEY) === CONSENT_VALUE.GRANTED;
}

/** Persist the analytics consent so it can be applied on the next cold start. */
export function setStoredAnalyticsConsent(enabled: boolean): void {
  setSecureItemSync(ANALYTICS_CONSENT_KEY, enabled ? CONSENT_VALUE.GRANTED : CONSENT_VALUE.DENIED);
}
