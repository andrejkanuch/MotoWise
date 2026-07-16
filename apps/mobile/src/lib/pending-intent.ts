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
 * (the reader short-circuits before any I/O) without touching the rest of
 * onboarding. The Android referrer reader MUST check this before doing work.
 */
export const INTENT_PREFILL_ENABLED = true;

/**
 * Query-string keys the web tags onto the Google Play install referrer
 * (PR #163, apps/web `storeAnchorProps` → `buildPlayReferrer`).
 */
export const INTENT_PARAM = {
  MAKE: 'mv_make',
  MODEL: 'mv_model',
  SOURCE: 'utm_source',
  CAMPAIGN: 'utm_campaign',
} as const;

/**
 * How the intent arrived. Android install referrer is the only transport — iOS
 * has none (App Store strips referrers; the clipboard path was removed to avoid
 * a paste prompt at onboarding). Kept as an object for analytics `method`.
 */
export const INTENT_METHOD = {
  REFERRER: 'referrer',
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
 * Parse the Android Play install-referrer string — a plain query string
 * (`utm_source=blog&mv_make=Yamaha&mv_model=MT-07`) — into a `PendingIntent`, or
 * null. A missing/blank make yields null (nothing to seed without a make).
 */
export function parseIntentToken(raw: string | null | undefined): PendingIntent | null {
  try {
    if (typeof raw !== 'string') return null;
    const query = raw.trim().replace(/^[/?]+/, '');
    if (!query) return null;

    const params = new URLSearchParams(query);
    const make = clean(params.get(INTENT_PARAM.MAKE));
    if (!make) return null;

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

/**
 * Resolve an intent's make against the app's make list, returning the canonical
 * `{ makeId, makeName }` (proper casing from the list) or null on no match.
 * Used by bike-setup to turn a stored `pendingIntent` into a pre-filled selection
 * once its make list has loaded. Never throws.
 */
export function resolveMakeFromIntent(
  intent: PendingIntent | null | undefined,
  makes: readonly MakeOption[],
): MakeOption | null {
  return intent ? findMakeMatch(intent.make, makes) : null;
}
