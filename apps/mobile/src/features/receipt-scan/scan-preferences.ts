import { createMMKV } from 'react-native-mmkv';

/**
 * Small durable prefs for the receipt-scan flow.
 * Currently: whether the rider has accepted the first-scan AI-consent disclosure
 * (PRD §5 — shown once, then remembered).
 */

const prefs = createMMKV({ id: 'receipt-scan-prefs' });

const CONSENT_ACCEPTED_KEY = 'consent.accepted';

export function hasAcceptedScanConsent(): boolean {
  return prefs.getBoolean(CONSENT_ACCEPTED_KEY) ?? false;
}

export function setScanConsentAccepted(): void {
  prefs.set(CONSENT_ACCEPTED_KEY, true);
}

/**
 * Clear the AI-consent flag. Called from the auth logout / account-switch cleanup
 * so a second rider on a shared device is shown the first-scan disclosure again
 * rather than inheriting the previous account's consent (EU informed consent).
 */
export function clearScanConsent(): void {
  prefs.clearAll();
}
