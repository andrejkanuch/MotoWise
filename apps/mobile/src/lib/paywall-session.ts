import { AppState, type AppStateStatus } from 'react-native';

/**
 * Who started a paywall present (issue 365 T05a). `auto`: the app presented it on its
 * own (a feature gate, a limit, onboarding). `rider_tap`: the rider asked for it
 * on an explicit Upgrade surface. Without it, paywall events could not tell the
 * two apart, so repeated automatic paywalls were unmeasurable.
 */
export const PAYWALL_TRIGGER = {
  AUTO: 'auto',
  RIDER_TAP: 'rider_tap',
} as const;

export type PaywallTrigger = (typeof PAYWALL_TRIGGER)[keyof typeof PAYWALL_TRIGGER];

/**
 * Which frequency policy decided that this paywall may show. `none` until the
 * session cap ships (T21), which sets `capped_v1` on the presents it allows.
 */
export const PAYWALL_GATE_POLICY = {
  NONE: 'none',
  CAPPED_V1: 'capped_v1',
} as const;

export type PaywallGatePolicy = (typeof PAYWALL_GATE_POLICY)[keyof typeof PAYWALL_GATE_POLICY];

/**
 * Event names the T21 session cap fires. Held here, not in `AnalyticsEvent`,
 * because that catalog admits only constants with a call site
 * (lib/__tests__/analytics-event-catalog.test.ts); T21 moves them there when it
 * adds the `trackEvent` calls. Same names as PAYWALL_GATE_EVENTS in
 * packages/analytics.
 *
 * TODO(T21, issue 430): move these two names into `AnalyticsEvent` together with
 * their `trackEvent` calls and delete this map. Do not fire them through this
 * map or a second one: event names live in one catalog.
 */
export const PAYWALL_GATE_EVENT = {
  /** An automatic paywall was not shown: `{feature, surface, reason}`. */
  PAYWALL_SUPPRESSED: 'paywall_suppressed',
  /** The limit sheet shown instead of a capped paywall: `{feature, surface}`. */
  LIMIT_SHEET_VIEWED: 'limit_sheet_viewed',
} as const;

/**
 * Why a paywall was not shown (`paywall_suppressed.reason`). Fired by the T21
 * cap: one automatic present per feature per session, two per session, and a
 * cooldown after a paywall error.
 */
export const PAYWALL_SUPPRESSED_REASON = {
  FEATURE_CAP: 'feature_cap',
  SESSION_CAP: 'session_cap',
  ERROR_COOLDOWN: 'error_cooldown',
} as const;

export type PaywallSuppressedReason =
  (typeof PAYWALL_SUPPRESSED_REASON)[keyof typeof PAYWALL_SUPPRESSED_REASON];

/** A paywall session ends after this long in the background (or on a cold start). */
export const PAYWALL_SESSION_BACKGROUND_RESET_MS = 30 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;
const APP_STATE_ACTIVE: AppStateStatus = 'active';

// In memory on purpose: a cold start is a new session.
let sessionPaywallCount = 0;
let backgroundedAt: number | null = null;
let onboardingCompletedAt: number | null = null;
let listening = false;

function handleAppStateChange(state: AppStateStatus): void {
  const now = Date.now();
  if (state !== APP_STATE_ACTIVE) {
    backgroundedAt ??= now;
    return;
  }
  if (backgroundedAt !== null && now - backgroundedAt > PAYWALL_SESSION_BACKGROUND_RESET_MS) {
    sessionPaywallCount = 0;
  }
  backgroundedAt = null;
}

// Installed on the first present: before it the count is 0, so nothing to reset.
function ensureAppStateListener(): void {
  if (listening) return;
  listening = true;
  AppState.addEventListener('change', handleAppStateChange);
}

/** Counts one paywall present in this session and returns its 1-based index. */
export function nextSessionPaywallIndex(): number {
  ensureAppStateListener();
  sessionPaywallCount += 1;
  return sessionPaywallCount;
}

/** Called when the rider finishes onboarding in this app run. */
export function recordOnboardingCompleted(now: number = Date.now()): void {
  onboardingCompletedAt = now;
}

/**
 * Whole minutes since onboarding was completed in this app run; null when it was
 * not (still onboarding, or completed before the last cold start).
 */
export function minutesSinceOnboardingCompleted(now: number = Date.now()): number | null {
  if (onboardingCompletedAt === null) return null;
  return Math.max(0, Math.floor((now - onboardingCompletedAt) / MS_PER_MINUTE));
}

/** Starts a fresh session, as a cold start does. */
export function resetPaywallSession(): void {
  sessionPaywallCount = 0;
  backgroundedAt = null;
  onboardingCompletedAt = null;
}
