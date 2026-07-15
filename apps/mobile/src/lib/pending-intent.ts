import { MileageUnit, MotorcycleType } from '@motovault/types';
import { useOnboardingStore } from '../stores/onboarding.store';

/**
 * Web→app "which bike" intent — carried across the store boundary so a rider who
 * read an article about a specific bike (e.g. "Yamaha MT-07 maintenance schedule")
 * lands in a pre-filled onboarding instead of an empty garage. See
 * docs/SEO-Conversion-IMPLEMENTATION-2026-07-15.md §5 (P2/P3.2).
 *
 * RULE #0 — this whole path is a bonus layer on top of the existing onboarding.
 * Every function here fails open: any bad input, parse failure, or unmatched make
 * returns null / false and leaves the normal onboarding flow completely untouched.
 * Nothing in this module may throw.
 */

/**
 * Master kill switch. Flip to false to disable the entire intent path instantly
 * (readers short-circuit before any I/O, seed refuses) without touching the rest
 * of onboarding. Readers (Android referrer / iOS clipboard) MUST check this
 * before doing native work.
 */
export const INTENT_PREFILL_ENABLED = true;

/**
 * Query-string keys the web tags onto the Google Play install referrer and the
 * iOS `mvintent://` clipboard token (PR #163, apps/web `storeAnchorProps`).
 */
export const INTENT_PARAM = {
  MAKE: 'mv_make',
  MODEL: 'mv_model',
  SOURCE: 'utm_source',
  CAMPAIGN: 'utm_campaign',
  TS: 'ts',
} as const;

/**
 * iOS clipboard token prefix — an https URL (NOT a custom scheme) on purpose: the
 * reader gates its (permission-prompting) clipboard read behind
 * `Clipboard.hasUrlAsync()`, which only detects real URLs. An https URL is
 * reliably detected, so organic users with no URL on their clipboard are never
 * prompted; a custom scheme like `mvintent://` would not be detected and the
 * feature would silently never seed. The `/i` path marks it as an intent token.
 * Kept in sync with the web writer (`apps/web` campaign.ts, `buildIntentToken`).
 */
export const INTENT_TOKEN_URL_PREFIX = 'https://motovault.app/i';

/**
 * Max age of an iOS clipboard token. A token older than this (or improbably far
 * in the future) is treated as a stale/unrelated paste and ignored. Referrer
 * strings carry no `ts` and are not TTL-checked — the OS only hands them over on
 * a genuine first install.
 *
 * Sized to survive a real App Store install: the token is written at store-click
 * and only read on first launch, so the window must cover download + install +
 * first-open, which routinely exceeds a couple of minutes on cellular. 60 min is
 * generous for that while still discarding genuinely stale pasteboard contents
 * (our scheme tokens are not something a user keeps around for an hour).
 */
export const INTENT_TOKEN_TTL_MS = 60 * 60 * 1000;

/** How the intent arrived — used for analytics (`method`) and cohorting. */
export const INTENT_METHOD = {
  REFERRER: 'referrer',
  CLIPBOARD: 'clipboard',
} as const;
export type IntentMethod = (typeof INTENT_METHOD)[keyof typeof INTENT_METHOD];

/**
 * Durable cohort tag for a resolved intent — registered as a PostHog super
 * property so the whole funnel (not just one event) is segmentable, and read by
 * paywall personalization to pick the maintenance-led placement (P3.2).
 */
export const INTENT_COHORT = {
  MAINTENANCE: 'maintenance',
  BLOG: 'blog',
  TOOL: 'tool',
  OTHER: 'intent',
} as const;
export type IntentCohort = (typeof INTENT_COHORT)[keyof typeof INTENT_COHORT];

export interface PendingIntent {
  /** Make name as tagged by the web (raw casing; match via resolveMakeId). */
  make: string;
  /** Model name, or null when the article was make-level only. */
  model: string | null;
  /** utm_source that carried the intent (e.g. 'blog', 'tool'). */
  source: string | null;
  /** utm_campaign (e.g. 'blog_maintenance'), when present. */
  campaign: string | null;
}

/** A make option from the app's make list (MotorcycleMakesQuery item shape). */
export interface MakeOption {
  makeId: number;
  makeName: string;
}

const MAX_VALUE_LENGTH = 64;

/** Trim, length-cap, and null out empties. Never throws. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse an intent token from either transport into a `PendingIntent`, or null.
 *
 * - Android: the Play install referrer, a plain query string
 *   (`utm_source=blog&mv_make=Yamaha&mv_model=MT-07`). No TTL.
 * - iOS: the clipboard token
 *   (`https://motovault.app/i?mv_make=Yamaha&...&ts=<epoch_ms>`). The URL prefix
 *   is required and a stale/garbage `ts` rejects it.
 *
 * A missing/blank make yields null — there is nothing to seed without a make.
 * `nowMs` is injectable for deterministic tests.
 */
export function parseIntentToken(
  raw: string | null | undefined,
  nowMs: number = Date.now(),
): PendingIntent | null {
  try {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const isToken = trimmed.startsWith(INTENT_TOKEN_URL_PREFIX);
    // iOS token: take the query after the URL's first `?`. Referrer: it IS the
    // query string, so just strip any leading `?`/`/`.
    let query: string;
    if (isToken) {
      const qIdx = trimmed.indexOf('?');
      query = qIdx >= 0 ? trimmed.slice(qIdx + 1) : '';
    } else {
      query = trimmed.replace(/^[/?]+/, '');
    }
    if (!query) return null;

    const params = new URLSearchParams(query);

    const make = clean(params.get(INTENT_PARAM.MAKE));
    if (!make) return null;

    // Clipboard tokens must carry a fresh timestamp; referrer strings do not.
    if (isToken) {
      const tsRaw = params.get(INTENT_PARAM.TS);
      const ts = tsRaw ? Number.parseInt(tsRaw, 10) : Number.NaN;
      if (!Number.isFinite(ts)) return null;
      // Reject stale tokens and improbable future timestamps (clock skew/garbage).
      if (ts < nowMs - INTENT_TOKEN_TTL_MS || ts > nowMs + INTENT_TOKEN_TTL_MS) return null;
    }

    return {
      make,
      model: clean(params.get(INTENT_PARAM.MODEL)),
      source: clean(params.get(INTENT_PARAM.SOURCE)),
      campaign: clean(params.get(INTENT_PARAM.CAMPAIGN)),
    };
  } catch {
    return null;
  }
}

/** utm_source → cohort dispatch table (data-driven, no branch chain). */
const SOURCE_TO_COHORT: Record<string, IntentCohort> = {
  blog: INTENT_COHORT.BLOG,
  tool: INTENT_COHORT.TOOL,
};

/**
 * Classify a resolved intent into a cohort. A maintenance campaign
 * (`utm_campaign` contains "maintenance") is the money cohort — it drives the
 * reminder-led paywall (P3.2); otherwise map the source, then a generic
 * `intent` tag. Never throws.
 */
export function getIntentCohort(intent: PendingIntent): IntentCohort {
  try {
    if (intent.campaign?.toLowerCase().includes('maintenance')) return INTENT_COHORT.MAINTENANCE;
    return SOURCE_TO_COHORT[intent.source ?? ''] ?? INTENT_COHORT.OTHER;
  } catch {
    return INTENT_COHORT.OTHER;
  }
}

/** True when the intent should lead the paywall with maintenance-reminder copy. */
export function isMaintenanceIntent(intent: PendingIntent | null | undefined): boolean {
  return !!intent && getIntentCohort(intent) === INTENT_COHORT.MAINTENANCE;
}

/** Case-insensitively find a make in the app's list. Never throws. */
function findMakeMatch(
  makeName: string | null | undefined,
  makes: readonly MakeOption[],
): MakeOption | null {
  try {
    const target = clean(makeName)?.toLowerCase();
    if (!target || !Array.isArray(makes)) return null;
    return makes.find((m) => m?.makeName?.toLowerCase() === target) ?? null;
  } catch {
    return null;
  }
}

/**
 * Map a make NAME to its NHTSA makeId via the app's make list
 * (case-insensitive), or null when there is no confident match.
 */
export function resolveMakeId(
  makeName: string | null | undefined,
  makes: readonly MakeOption[],
): number | null {
  return findMakeMatch(makeName, makes)?.makeId ?? null;
}

/** Fallback default when no profile mileage unit is available (EU-dominant). */
const DEFAULT_MILEAGE_UNIT: MileageUnit = MileageUnit.KM;
/** Match bike-setup's default year (`currentYear - 3`) for a make-only seed. */
const DEFAULT_YEAR_OFFSET = 3;

/**
 * Seed the onboarding store from a resolved intent. Only seeds when the make is
 * confidently matched against `makes`; otherwise returns false and leaves the
 * store untouched (→ normal flow). Mirrors bike-setup's make-only partial
 * capture (year defaulted, model optional, type STANDARD) so a valid bike is
 * already staged even if the rider drops off before the confirmation step, and
 * records `pendingIntent` as the signal the confirmation UI / paywall read.
 *
 * The model string is stored as-is: an unknown/wrong model degrades gracefully
 * because the OEM-schedule query returns nothing and the maintenance step
 * auto-skips — no new failure mode is introduced. Never throws.
 */
export function seedBikeDataFromIntent(
  intent: PendingIntent,
  makes: readonly MakeOption[],
  opts?: { defaultYear?: number; mileageUnit?: MileageUnit },
): boolean {
  try {
    if (!INTENT_PREFILL_ENABLED) return false;
    const match = findMakeMatch(intent.make, makes);
    if (!match) return false;

    const store = useOnboardingStore.getState();
    store.setBikeData({
      year: opts?.defaultYear ?? new Date().getFullYear() - DEFAULT_YEAR_OFFSET,
      make: match.makeName,
      makeId: match.makeId,
      model: intent.model ?? '',
      type: MotorcycleType.STANDARD,
      currentMileage: 0,
      mileageUnit: opts?.mileageUnit ?? DEFAULT_MILEAGE_UNIT,
    });
    store.setPendingIntent(intent);
    return true;
  } catch {
    return false;
  }
}
