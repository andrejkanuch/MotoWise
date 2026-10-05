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
//    accepts on the consent screen (app/analytics-consent.tsx, a root route), which
//    the root layout presents once the rider leaves the welcome screen.
//
// The decision lives in the keychain so it can be read synchronously at module
// load, before PostHog is constructed. Reads go through lib/secure-store, so a
// locked device (a background launch) never throws — it yields UNKNOWN, which
// is treated as "not granted" and never overwritten. (MOTO-VAULT-REACT-NATIVE-2D)
// -------------------------------------------------------------------

/** Keychain key holding the analytics consent decision. */
export const ANALYTICS_CONSENT_KEY = SECURE_STORE_KEY.ANALYTICS_CONSENT;

/**
 * Persisted consent values.
 *
 * - An explicit decision (the consent screen, the Privacy toggle, or one taken
 *   over from the account) is `granted:v2:<ms>` / `denied:v2:<ms>`, stamped with
 *   when it was made, so the newer of the device's and the account's decisions
 *   can win (see {@link reconcileConsent}).
 * - The automatic opt-out-region grant is `granted-default:v2`: it counts as
 *   granted here, but it is not a choice, so it is never uploaded to the
 *   account (where an opt-in-region device would otherwise trust it).
 * - Before 3.21.0 values were `'true'`/`'false'` and not all real choices: the
 *   Privacy screen saved its default "yes" just by being opened. A legacy "yes"
 *   is not honoured where opt-in is required (that rider is asked once); a
 *   legacy "no" is always honoured.
 */
const CONSENT_VALUE = {
  GRANTED_PREFIX: 'granted:v2:',
  DENIED_PREFIX: 'denied:v2:',
  DEFAULT_GRANTED: 'granted-default:v2',
  LEGACY_GRANTED: 'true',
  LEGACY_DENIED: 'false',
} as const;

/** A decision and when it was made (epoch ms; 0 when unknown, i.e. oldest). */
export interface ConsentDecision {
  enabled: boolean;
  decidedAt: number;
  /**
   * Set on an account value written before 3.21.0 (no timestamp, no version).
   * A legacy "no" is authoritative — it may be newer than any 3.21 decision,
   * since 3.20 apps are still live. A legacy "yes" is only the old default, so
   * it is taken over as the automatic grant, never as an explicit decision.
   */
  legacy?: true;
}

/** What a stored value means, for a readable keychain. */
interface StoredConsent {
  state: ConsentState;
  /** Only an explicit decision is ever uploaded to the account. */
  decision: ConsentDecision | null;
}

/**
 * Version stamped on the account's `preferences.privacy.consentVersion` with
 * every decision made from 3.21.0 on. A server `analyticsEnabled: true` without
 * it is the same unreliable legacy default as above.
 */
export const CONSENT_VERSION = 2;

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
 * Liechtenstein, Norway), the EU outermost regions that have their own codes
 * (RE, GP, MQ, GF, YT, MF, AX), the United Kingdom and Switzerland. ISO 3166-1
 * alpha-2, as `expo-localization` reports `regionCode` (e.g. fr-RE → RE).
 * Mirrors `OPT_IN_COUNTRIES` (apps/api/src/modules/webhooks/revenuecat-posthog.ts)
 * and `CONSENT_REQUIRED_COUNTRIES` (apps/web/src/lib/consent-region.ts) — change all three together.
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
  // EU outermost regions reported under their own ISO codes (GDPR applies)
  'RE',
  'GP',
  'MQ',
  'GF',
  'YT',
  'MF',
  'AX',
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

/** Explicit-decision prefixes → the decision they encode. */
const DECISION_PREFIXES: ReadonlyArray<readonly [string, boolean]> = [
  [CONSENT_VALUE.GRANTED_PREFIX, true],
  [CONSENT_VALUE.DENIED_PREFIX, false],
];

/**
 * Parse a stored value. Returns null for "no decision": nothing stored, an
 * unrecognised value, or a legacy "yes" (which the caller resolves by region).
 */
function parseStoredConsent(value: unknown): StoredConsent | null {
  if (typeof value !== 'string' || !value) return null;
  if (value === CONSENT_VALUE.DEFAULT_GRANTED) {
    return { state: CONSENT_STATE.GRANTED, decision: null };
  }
  if (value === CONSENT_VALUE.LEGACY_DENIED) {
    return { state: CONSENT_STATE.DENIED, decision: { enabled: false, decidedAt: 0 } };
  }
  for (const [prefix, enabled] of DECISION_PREFIXES) {
    if (!value.startsWith(prefix)) continue;
    const decidedAt = Number(value.slice(prefix.length));
    const decision = { enabled, decidedAt: Number.isFinite(decidedAt) ? decidedAt : 0 };
    return { state: enabled ? CONSENT_STATE.GRANTED : CONSENT_STATE.DENIED, decision };
  }
  return null;
}

/**
 * Resolve the consent decision for this launch, synchronously.
 *
 * A stored decision always wins, except a legacy "yes" (see CONSENT_VALUE),
 * which counts as no decision. With none, an opt-out region is granted AND
 * persisted (so attribution, replay and RevenueCat — which read the stored
 * flag — agree with the events), and an opt-in region stays UNDECIDED until
 * the rider answers the consent screen. An unreadable keychain
 * is UNKNOWN and nothing is written, so a locked background launch can never
 * overwrite a rider's "no".
 */
export function resolveLaunchConsent(regionCode: string | null = getDeviceRegion()): ConsentState {
  const read = readSecureItemSync(ANALYTICS_CONSENT_KEY);
  if (read.status !== SECURE_STORE_STATUS.OK) return CONSENT_STATE.UNKNOWN;
  const stored = parseStoredConsent(read.value);
  // Legacy "yes" falls through to the no-decision path below.
  if (stored) return stored.state;
  if (requiresOptIn(regionCode)) return CONSENT_STATE.UNDECIDED;
  // Not a choice: stored as the automatic grant, never uploaded to the account.
  setSecureItemSync(ANALYTICS_CONSENT_KEY, CONSENT_VALUE.DEFAULT_GRANTED);
  return CONSENT_STATE.GRANTED;
}

/**
 * Read the last-known analytics consent synchronously.
 *
 * Returns `false` when nothing is persisted, the keychain is locked, or the
 * value is a legacy "yes" — the conservative default. Opt-out regions are
 * persisted (as the automatic grant, `granted-default:v2`) at launch by
 * {@link resolveLaunchConsent},
 * so for them this is `true` from then on.
 */
export function getStoredAnalyticsConsent(): boolean {
  return (
    parseStoredConsent(getSecureItemSync(ANALYTICS_CONSENT_KEY))?.state === CONSENT_STATE.GRANTED
  );
}

/** True when the rider has never answered and the region needs an answer. */
export function isConsentPromptOwed(): boolean {
  return resolveLaunchConsent() === CONSENT_STATE.UNDECIDED;
}

/**
 * Persist a decision so it applies on the next cold start. `decidedAt` defaults
 * to now; pass the account's timestamp when taking over its decision, so the two
 * compare equal afterwards instead of re-uploading. `null` marks a "yes" that is
 * not a choice (a legacy account default): it is stored as the automatic grant.
 */
export function setStoredAnalyticsConsent(
  enabled: boolean,
  decidedAt: number | null = Date.now(),
): void {
  if (decidedAt === null && enabled) {
    setSecureItemSync(ANALYTICS_CONSENT_KEY, CONSENT_VALUE.DEFAULT_GRANTED);
    return;
  }
  const prefix = enabled ? CONSENT_VALUE.GRANTED_PREFIX : CONSENT_VALUE.DENIED_PREFIX;
  setSecureItemSync(ANALYTICS_CONSENT_KEY, `${prefix}${decidedAt ?? 0}`);
}

/**
 * The timestamp to store when taking over an account decision: its own, or
 * null for a legacy "yes" (stored as the automatic grant, never uploaded).
 */
export function storedTimestampFor(decision: ConsentDecision): number | null {
  return decision.legacy && decision.enabled ? null : decision.decidedAt;
}

/** The `preferences.privacy` shape the consent model reads from the account. */
export interface AccountPrivacyPreference {
  analyticsEnabled?: unknown;
  crashReportingEnabled?: unknown;
  consentVersion?: unknown;
  /** When the analytics decision was made (epoch ms); absent before 3.21.0. */
  decidedAt?: unknown;
}

/**
 * The analytics decision an account carries that is safe to apply on this
 * device, or null when it carries none. A "no" always applies. A "yes" applies
 * when it was given under the versioned model, or where opt-in is not required
 * — an unversioned "yes" from an opt-in region is the legacy Privacy-screen
 * default, not a choice.
 */
export function accountConsentDecision(
  privacy: AccountPrivacyPreference | null | undefined,
  regionCode: string | null = getDeviceRegion(),
): ConsentDecision | null {
  if (typeof privacy?.analyticsEnabled !== 'boolean') return null;
  const dated = typeof privacy.decidedAt === 'number' && Number.isFinite(privacy.decidedAt);
  const decidedAt = dated ? (privacy.decidedAt as number) : 0;
  const versioned =
    typeof privacy.consentVersion === 'number' && privacy.consentVersion >= CONSENT_VERSION;
  const legacy = !dated || !versioned;
  const decision = (enabled: boolean): ConsentDecision =>
    legacy ? { enabled, decidedAt, legacy: true } : { enabled, decidedAt };
  if (!privacy.analyticsEnabled) return decision(false);
  return versioned || !requiresOptIn(regionCode) ? decision(true) : null;
}

/**
 * This device's own explicit decision, or null — for UNDECIDED, UNKNOWN, and
 * the automatic opt-out-region grant (not a choice, so never uploaded).
 * Read-only: unlike {@link resolveLaunchConsent} it never writes.
 */
export function deviceConsentDecision(): ConsentDecision | null {
  const read = readSecureItemSync(ANALYTICS_CONSENT_KEY);
  if (read.status !== SECURE_STORE_STATUS.OK) return null;
  return parseStoredConsent(read.value)?.decision ?? null;
}

/** What to do when the device's and the account's decisions are compared. */
export interface ConsentReconciliation {
  /** The account's decision, to take over on this device. */
  apply: ConsentDecision | null;
  /** The device's decision, to save to the account. */
  upload: ConsentDecision | null;
}

/**
 * Reconcile this device's explicit decision with the account's. The newer
 * decision wins; on a tie the "no" wins. A decision only one side has goes to
 * the other side. Nothing happens when they agree. Pure — callers do the I/O.
 */
export function reconcileConsent(
  device: ConsentDecision | null,
  account: ConsentDecision | null,
): ConsentReconciliation {
  const none: ConsentReconciliation = { apply: null, upload: null };
  if (!device) return account ? { apply: account, upload: null } : none;
  if (!account) return { apply: null, upload: device };
  if (device.enabled === account.enabled) return none;
  // A pre-3.21 "no" has no timestamp but may be the newest decision (3.20 apps
  // are still live), so it is never overturned.
  if (account.legacy && !account.enabled) return { apply: account, upload: null };
  const deviceWins =
    device.decidedAt > account.decidedAt ||
    (device.decidedAt === account.decidedAt && !device.enabled);
  return deviceWins ? { apply: null, upload: device } : { apply: account, upload: null };
}

/** A change to the account's privacy preferences. */
export interface PrivacyChange {
  /** A new analytics decision — saved versioned and timestamped. */
  analytics?: ConsentDecision;
  crashReportingEnabled?: boolean;
}

/**
 * The full `preferences.privacy` object to save for a change. The server merges
 * `preferences` one level deep, so `privacy` is replaced whole: every key not
 * being changed is carried over exactly as stored. In particular a crash-only
 * change leaves an unversioned legacy "yes" unversioned — it must never be
 * turned into a trusted decision as a side effect.
 */
export function buildPrivacyUpdate(
  current: AccountPrivacyPreference | null | undefined,
  change: PrivacyChange,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  if (change.analytics) {
    next.analyticsEnabled = change.analytics.enabled;
    next.decidedAt = change.analytics.decidedAt;
    next.consentVersion = CONSENT_VERSION;
  }
  if (change.crashReportingEnabled !== undefined) {
    next.crashReportingEnabled = change.crashReportingEnabled;
  }
  return next;
}

/**
 * Sign-up metadata key carrying the rider's decision to the server. The signup
 * sweep falls back to it when the account has no saved decision — which is the
 * case for an email sign-up that confirms later than the sweep's 10-minute wait
 * (no session until confirmation, so the app cannot upload it). See 00184.
 */
export const SIGNUP_CONSENT_METADATA_KEY = 'analytics_consent';

/** `options.data` to merge into `supabase.auth.signUp`: the explicit decision, if any. */
export function signUpConsentMetadata(): Record<string, boolean> {
  const decision = deviceConsentDecision();
  return decision ? { [SIGNUP_CONSENT_METADATA_KEY]: decision.enabled } : {};
}
