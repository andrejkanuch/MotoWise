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
