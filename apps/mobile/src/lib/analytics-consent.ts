import { getLocales } from 'expo-localization';
import {
  getSecureItemSync,
  readSecureItemSync,
  SECURE_STORE_KEY,
  SECURE_STORE_STATUS,
  setSecureItemSync,
} from './secure-store';

// -------------------------------------------------------------------
// Analytics consent — one model for events, replay and attribution
// -------------------------------------------------------------------
// One persisted decision gates EVERYTHING analytics: PostHog events (incl. the
// SDK's own lifecycle events), session replay, install attribution and
// RevenueCat attribution. Before this, events flowed pre-consent while a
// separate stored flag (false on every fresh install) blocked attribution —
// which is why only ~2% of installs ever recorded an install source.
//
// The default depends on where the rider is:
//  - Outside the EEA/UK/Switzerland: opt-OUT. A fresh install is treated as
//    consenting and the decision is persisted at first launch; the rider can
//    turn it off in Settings → Privacy.
//  - Inside (or region unknown): opt-IN. Nothing is sent until the rider
//    accepts on the consent screen (app/(modals)/analytics-consent.tsx), which
//    the root layout presents once the rider leaves the welcome screen.
//
// The decision lives in the keychain so it can be read synchronously at module
// load, before PostHog is constructed. Reads go through lib/secure-store, so a
// locked device (a background launch) never throws — it yields UNKNOWN, which
// is treated as "not granted" and never overwritten. (MOTO-VAULT-REACT-NATIVE-2D)
// -------------------------------------------------------------------

/** Keychain key holding the analytics consent decision. */
export const ANALYTICS_CONSENT_KEY = SECURE_STORE_KEY.ANALYTICS_CONSENT;

/** The two persisted consent values. */
const CONSENT_VALUE = {
  GRANTED: 'true',
  DENIED: 'false',
} as const;

export const CONSENT_STATE = {
  GRANTED: 'granted',
  DENIED: 'denied',
  /** No decision yet, in an opt-in region — the consent screen is owed. */
  UNDECIDED: 'undecided',
  /** The keychain could not be read (locked device). Treated as not granted. */
  UNKNOWN: 'unknown',
} as const;
export type ConsentState = (typeof CONSENT_STATE)[keyof typeof CONSENT_STATE];

/**
 * Regions where analytics needs prior opt-in: the EEA (EU-27 + Iceland,
 * Liechtenstein, Norway), the United Kingdom and Switzerland. ISO 3166-1
 * alpha-2, as `expo-localization` reports `regionCode`.
 */
const OPT_IN_REGIONS: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
]);

/**
 * True when the rider must opt in before anything is sent. An unknown region
 * counts as opt-in — the conservative answer.
 */
export function requiresOptIn(regionCode: string | null | undefined): boolean {
  if (!regionCode) return true;
  return OPT_IN_REGIONS.has(regionCode.toUpperCase());
}

/** The device's region, or null when the OS reports none. Never throws. */
export function getDeviceRegion(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

/** Persisted value → state, for a readable keychain. */
const STORED_TO_STATE: Record<string, ConsentState> = {
  [CONSENT_VALUE.GRANTED]: CONSENT_STATE.GRANTED,
  [CONSENT_VALUE.DENIED]: CONSENT_STATE.DENIED,
};

/**
 * Resolve the consent decision for this launch, synchronously.
 *
 * A stored decision always wins. With none stored, an opt-out region is
 * granted AND persisted (so attribution, replay and RevenueCat — which read
 * the stored flag — agree with the events), and an opt-in region stays
 * UNDECIDED until the rider answers the consent screen. An unreadable keychain
 * is UNKNOWN and nothing is written, so a locked background launch can never
 * overwrite a rider's "no".
 */
export function resolveLaunchConsent(regionCode: string | null = getDeviceRegion()): ConsentState {
  const read = readSecureItemSync(ANALYTICS_CONSENT_KEY);
  if (read.status !== SECURE_STORE_STATUS.OK) return CONSENT_STATE.UNKNOWN;
  const stored = read.value ? STORED_TO_STATE[read.value] : undefined;
  if (stored) return stored;
  if (requiresOptIn(regionCode)) return CONSENT_STATE.UNDECIDED;
  setStoredAnalyticsConsent(true);
  return CONSENT_STATE.GRANTED;
}

/**
 * Read the last-known analytics consent synchronously.
 *
 * Returns `false` when nothing is persisted or the keychain is locked — the
 * conservative default. Opt-out regions are persisted at first launch by
 * {@link resolveLaunchConsent}, so for them this is `true` from then on.
 */
export function getStoredAnalyticsConsent(): boolean {
  return getSecureItemSync(ANALYTICS_CONSENT_KEY) === CONSENT_VALUE.GRANTED;
}

/** True when the rider has never answered and the region needs an answer. */
export function isConsentPromptOwed(): boolean {
  return resolveLaunchConsent() === CONSENT_STATE.UNDECIDED;
}

/** Persist the analytics consent so it can be applied on the next cold start. */
export function setStoredAnalyticsConsent(enabled: boolean): void {
  setSecureItemSync(ANALYTICS_CONSENT_KEY, enabled ? CONSENT_VALUE.GRANTED : CONSENT_VALUE.DENIED);
}
