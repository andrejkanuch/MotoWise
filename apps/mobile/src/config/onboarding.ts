/**
 * Onboarding variant values.
 *
 * The 2026 A/B experiment (PostHog 83476, flag `onboarding_ab_2026`) is RETIRED
 * as of 2026-08-24. `lean` won on both readable metrics — onboarding completion
 * 40.5% vs 29.4% and bike-add 75.2% vs 64.7%, each at roughly p≈0.02 — and one
 * flow now ships to everyone.
 *
 * `SHIPPED` is a NEW value rather than a reuse of `lean`, and that distinction is
 * load-bearing: the shipped flow is 11 screens, while experiment-era `lean` was
 * 14 (it still contained the paywall, maintenance and scan-receipt steps that U6
 * removed). Filing post-cutover users under `lean` would make every historical
 * funnel silently average two different flows together — the exact mistake the
 * PostHog cutover annotation exists to prevent.
 *
 * The three experiment values are kept as READ-ONLY legacy: ~423 users have one
 * persisted in MMKV and set as a PostHog person property, and that property is
 * the only record of which flow they went through. They are never assigned again,
 * they are never cleared, and they all resolve to the shipped flow so nobody is
 * stranded or reset mid-onboarding.
 */
export const OB_VARIANT = {
  /** The single shipped flow. Every new install gets this. */
  SHIPPED: 'shipped',
  /** RETIRED 2026-08-24 — the winning experiment arm. Read-only. */
  LEAN: 'lean',
  /** RETIRED 2026-08-24 — the losing experiment arm. Read-only. */
  INVESTED: 'invested',
  /** RETIRED 2026-08-24 — the 0%-rollout holdout / pre-test V4 flow. Read-only. */
  CONTROL: 'control',
} as const;

export type ObVariant = (typeof OB_VARIANT)[keyof typeof OB_VARIANT];

export function isObVariant(value: unknown): value is ObVariant {
  return typeof value === 'string' && Object.values(OB_VARIANT).includes(value as ObVariant);
}

/**
 * Onboarding screen identifiers (route segment names) — the single source of
 * truth. Use these constants instead of magic strings anywhere a screen is
 * referenced (resume tracking, Back fallback, progress index).
 */
export const OB_SCREEN = {
  // --- In the shipped flow ------------------------------------------------
  WELCOME: 'index',
  EXPERIENCE: 'experience',
  GOALS: 'goals',
  BIKE_SETUP: 'bike-setup',
  NOTIFICATIONS: 'notifications',
  PERSONALIZING: 'personalizing',
  REVEAL: 'reveal',
  // Value-payoff slot for riders who skipped bike-setup — the inverse of the
  // Reveal (which needs a bike). Shown only when there's no bike so skippers see
  // universal value instead of a cold empty garage (P2.3/T4b).
  NO_BIKE_VALUE: 'no-bike-value',
  COMMITMENT: 'commitment',
  ACCOUNT: 'account',
  // Attribution — "How did you hear about us?". Kept deliberately: 66 of 85
  // riders answer it, and self-reported attribution is the only working
  // install-attribution signal this product has.
  HEARD_ABOUT: 'heard-about',

  // --- Not a flow step ----------------------------------------------------
  // Standalone: returning-user sign-in, entered from Welcome "Log in".
  SIGN_IN: 'sign-in',

  // --- RETIRED 2026-08-24 — in NO flow ------------------------------------
  // Kept as identifiers for two reasons, both load-bearing:
  //   (a) `OB_STEP_NAME` must still resolve them, so historical
  //       `onboarding_step_viewed/completed/skipped` events stay readable in
  //       PostHog. Removing a step from the flow is not deleting its event.
  //   (b) `RETIRED_SCREEN_SUCCESSOR` needs them as keys, to resolve a persisted
  //       `lastCompletedScreen` forward when this ships as an OTA.
  // Do NOT add any of these back to a flow.
  //
  // maintenance / paywall / scan-receipt still have route files (reachable in
  // principle by a deep link, and `insights.tsx` in the dead V1 chain still
  // hardcodes a jump to the paywall). The four invested-arm screens do not —
  // their files were deleted with the arm.
  MAINTENANCE: 'maintenance',
  PAYWALL: 'paywall',
  SCAN_RECEIPT: 'scan-receipt',
  FREQUENCY: 'frequency',
  STAY_ON_TOP: 'stay-on-top',
  LAST_SERVICE: 'last-service',
  BUILDING_PLAN: 'building-plan',
} as const;

export type OnboardingRoute = (typeof OB_SCREEN)[keyof typeof OB_SCREEN];

/**
 * The one shipped onboarding flow — drives the progress index, resume target,
 * Back fallback, and forward navigation.
 *
 * Descended from the winning `lean` arm with three steps removed (U6, 14 → 11):
 *
 *  - `paywall`     sold before the app had delivered anything. It sat at step 5,
 *                  BEFORE the account step, and 395 of 692 people who started
 *                  onboarding saw it. Paid conversion is now driven only by
 *                  gated-feature triggers, which already exist and already fire
 *                  (`presentPaywall({ placement: 'feature_gate' })`).
 *  - `maintenance` completed by 2 of 150 riders who saw it. 146 skipped.
 *  - `scan_receipt` completed by 0 of 40. Every single one skipped.
 *
 * Kept deliberately: `heard_about` (66 of 85 answer it, and self-reported
 * attribution is the only working install-attribution signal this product has).
 */
const SHIPPED_FLOW = [
  OB_SCREEN.WELCOME,
  OB_SCREEN.EXPERIENCE,
  OB_SCREEN.BIKE_SETUP,
  OB_SCREEN.REVEAL,
  OB_SCREEN.NO_BIKE_VALUE,
  OB_SCREEN.GOALS,
  OB_SCREEN.COMMITMENT,
  OB_SCREEN.ACCOUNT,
  OB_SCREEN.HEARD_ABOUT,
  OB_SCREEN.NOTIFICATIONS,
  OB_SCREEN.PERSONALIZING,
] as const satisfies ReadonlyArray<OnboardingRoute>;

/**
 * Every variant value resolves to the same flow. This is what "retire the arms
 * without resetting anyone" means concretely: a rider who is mid-onboarding with
 * `invested` persisted in MMKV keeps a valid flow and simply continues, rather
 * than hitting an undefined lookup or being re-rolled onto a different path.
 */
export const ONBOARDING_FLOWS: Record<ObVariant, ReadonlyArray<OnboardingRoute>> = {
  [OB_VARIANT.SHIPPED]: SHIPPED_FLOW,
  [OB_VARIANT.LEAN]: SHIPPED_FLOW,
  [OB_VARIANT.INVESTED]: SHIPPED_FLOW,
  [OB_VARIANT.CONTROL]: SHIPPED_FLOW,
};

/**
 * Length of the pre-experiment V4 flow. Referenced only by the retired V1
 * screens (bike-year → … → smart-maintenance → insights), which are unreachable
 * from any flow but still compile — see the removal note in `(onboarding)/_layout`.
 * A literal now that V4_FLOW is gone. Do not use in new code; active screens
 * derive progress from `useOnboardingStep`.
 */
export const TOTAL_SCREENS = 9;

/** Ordered screen list for a variant. */
export function getFlowScreens(variant: ObVariant): ReadonlyArray<OnboardingRoute> {
  return ONBOARDING_FLOWS[variant];
}

export function getTotalScreens(variant: ObVariant): number {
  return ONBOARDING_FLOWS[variant].length;
}

/**
 * Analytics step names per screen (snake_case, stable identifiers — these are
 * the values PostHog funnels filter on; never rename without migrating the
 * funnel definitions).
 */
export const OB_STEP_NAME: Record<OnboardingRoute, string> = {
  [OB_SCREEN.WELCOME]: 'welcome',
  [OB_SCREEN.EXPERIENCE]: 'experience',
  [OB_SCREEN.GOALS]: 'goals',
  [OB_SCREEN.BIKE_SETUP]: 'bike_setup',
  [OB_SCREEN.MAINTENANCE]: 'maintenance',
  [OB_SCREEN.PAYWALL]: 'paywall',
  [OB_SCREEN.NOTIFICATIONS]: 'notifications',
  [OB_SCREEN.PERSONALIZING]: 'personalizing',
  [OB_SCREEN.REVEAL]: 'reveal',
  [OB_SCREEN.NO_BIKE_VALUE]: 'no_bike_value',
  [OB_SCREEN.COMMITMENT]: 'commitment',
  [OB_SCREEN.ACCOUNT]: 'account',
  [OB_SCREEN.HEARD_ABOUT]: 'heard_about',
  [OB_SCREEN.SCAN_RECEIPT]: 'scan_receipt',
  [OB_SCREEN.FREQUENCY]: 'frequency',
  [OB_SCREEN.STAY_ON_TOP]: 'stay_on_top',
  [OB_SCREEN.LAST_SERVICE]: 'last_service',
  [OB_SCREEN.BUILDING_PLAN]: 'building_plan',
  [OB_SCREEN.SIGN_IN]: 'sign_in',
};

/**
 * Zero-based position of a screen within its variant's flow — drives the
 * `step_index` analytics property and the progress bar. Returns -1 for
 * screens not in the variant's flow (e.g. the standalone sign-in surface).
 */
export function getStepIndex(variant: ObVariant, route: OnboardingRoute): number {
  return ONBOARDING_FLOWS[variant].indexOf(route);
}

/** Type-safe onboarding route paths for router.push / router.replace */
export const OB_ROUTE = {
  EXPERIENCE: '/(onboarding)/experience',
  GOALS: '/(onboarding)/goals',
  BIKE_SETUP: '/(onboarding)/bike-setup',
  MAINTENANCE: '/(onboarding)/maintenance',
  PAYWALL: '/(onboarding)/paywall',
  NOTIFICATIONS: '/(onboarding)/notifications',
  PERSONALIZING: '/(onboarding)/personalizing',
  REVEAL: '/(onboarding)/reveal',
  NO_BIKE_VALUE: '/(onboarding)/no-bike-value',
  COMMITMENT: '/(onboarding)/commitment',
  ACCOUNT: '/(onboarding)/account',
  HEARD_ABOUT: '/(onboarding)/heard-about',
  SCAN_RECEIPT: '/(onboarding)/scan-receipt',
  // frequency / stay-on-top / last-service / building-plan are absent: those four
  // screens were invested-arm-only and their files were deleted with the arm.
  SIGN_IN: '/(onboarding)/sign-in',
  HOME: '/(tabs)/(home)',
} as const;

/** V2 riding goal priority ranking for determining primary goal */
export const GOAL_PRIORITY = [
  'track_rides',
  'manage_expenses',
  'discover_routes',
  'maintain_bike',
  'just_exploring',
] as const;

/** Get the primary goal from a list of selected goals (fixed priority, not tap order) */
export function getPrimaryGoal(goals: string[]): string {
  return GOAL_PRIORITY.find((g) => goals.includes(g)) ?? 'just_exploring';
}

/**
 * Variant B "stay on top of" concern priority ranking (fixed, not tap order).
 * Mirrors `GOAL_PRIORITY`: the highest-priority selected concern becomes
 * `primaryConcern`, which biases the Reveal's lead emphasis and the paywall
 * framing. Ids match `STAY_ON_TOP_OPTIONS` in the stay-on-top screen.
 * Costs leads (loss aversion → projection card first); `enjoy` is the casual
 * fallback (parallels `just_exploring`).
 */
export const CONCERN_PRIORITY = [
  'avoid_surprise_costs',
  'catch_issues_early',
  'never_miss_service',
  'keep_resale_value',
  'just_enjoy',
] as const;

/** Get the primary concern from selected concern ids (fixed priority, not tap order). */
export function getPrimaryConcern(concerns: string[]): string {
  return CONCERN_PRIORITY.find((c) => concerns.includes(c)) ?? 'just_enjoy';
}

/** Map primary goal to RevenueCat placement string */
export const GOAL_TO_PLACEMENT: Record<string, string> = {
  track_rides: 'onboarding_rides',
  manage_expenses: 'onboarding_rides',
  discover_routes: 'onboarding_routes',
  maintain_bike: 'onboarding_rides',
  just_exploring: 'onboarding_default',
} as const;

/**
 * RevenueCat placement for the maintenance-intent cohort (P3.2) — riders who
 * arrived from an article about a specific bike's service schedule. Overrides the
 * goal-derived placement so the paywall can lead with reminder value ("Never miss
 * your {{ custom.primaryBikeModel }}'s next service"). Configure this placement +
 * its Paywalls-v2 copy in the RC dashboard; falls back to the current offering if
 * the placement is missing, so the paywall still presents.
 */
export const MAINTENANCE_INTENT_PLACEMENT = 'onboarding_maintenance';

type OnboardingRoutePath =
  | `/(onboarding)/${Exclude<OnboardingRoute, typeof OB_SCREEN.WELCOME>}`
  | '/(onboarding)';

/**
 * Href for a screen. The welcome screen is the group's index file, so its route
 * is the group root `/(onboarding)` — NOT `/(onboarding)/index`, which Expo
 * Router does not recognize and renders as "Page not found" (hit when Back
 * falls through to the welcome step).
 */
function routeForScreen(screen: OnboardingRoute): OnboardingRoutePath {
  return screen === OB_SCREEN.WELCOME
    ? '/(onboarding)'
    : `/(onboarding)/${screen as Exclude<OnboardingRoute, typeof OB_SCREEN.WELCOME>}`;
}

/**
 * Screens that are no longer part of any flow, mapped to the surviving screen
 * that should follow them.
 *
 * This exists because removing a step from the flow array is NOT the whole job.
 * `lastCompletedScreen` is persisted in MMKV, so when this ships as an OTA there
 * are riders sitting mid-flow with `paywall`, `maintenance`, `scan-receipt` or
 * one of the four invested-only screens recorded as their last completed step.
 * Without a mapping, `flow.indexOf(current)` returns -1, `getNextRoute` returns
 * null, and the rider resumes into nothing — a permanent lockout of exactly the
 * kind the account screen's Back button already had to be fixed for.
 *
 * The successor is the screen each retired step used to precede in its own flow,
 * so resuming feels like continuing rather than jumping:
 *   frequency / stay-on-top / last-service → bike-setup  (all three preceded it)
 *   building-plan                          → reveal
 *   maintenance                            → commitment
 *   paywall                                → account
 *   scan-receipt                           → personalizing
 *
 * It also covers two non-resume cases for free: a deep link or notification
 * aimed at a retired route, and the retired V1 screen chain, whose `insights`
 * screen still does `router.replace('/(onboarding)/paywall')` as a raw string.
 */
const RETIRED_SCREEN_SUCCESSOR: Partial<Record<OnboardingRoute, OnboardingRoute>> = {
  [OB_SCREEN.FREQUENCY]: OB_SCREEN.BIKE_SETUP,
  [OB_SCREEN.STAY_ON_TOP]: OB_SCREEN.BIKE_SETUP,
  [OB_SCREEN.LAST_SERVICE]: OB_SCREEN.BIKE_SETUP,
  [OB_SCREEN.BUILDING_PLAN]: OB_SCREEN.REVEAL,
  [OB_SCREEN.MAINTENANCE]: OB_SCREEN.COMMITMENT,
  [OB_SCREEN.PAYWALL]: OB_SCREEN.ACCOUNT,
  [OB_SCREEN.SCAN_RECEIPT]: OB_SCREEN.PERSONALIZING,
};

/** True when `screen` is no longer in the shipped flow. */
export function isRetiredScreen(screen: OnboardingRoute): boolean {
  return screen in RETIRED_SCREEN_SUCCESSOR;
}

/**
 * Screens that only pay off when the rider has a bike. When there's no bike,
 * the flow routes *around* them (spec §4): a true bike-skip goes straight to
 * `goals` (no Reveal to pay off), and `goals` skips the Commitment (no plan to
 * commit to). `maintenance` used to be in this set and left with U6.
 */
const BIKE_DEPENDENT_SCREENS: ReadonlySet<OnboardingRoute> = new Set([
  OB_SCREEN.REVEAL,
  OB_SCREEN.COMMITMENT,
]);

/**
 * The inverse: screens that only pay off when the rider skipped their bike. When
 * a bike IS present the flow routes *around* them (a bike rider gets the Reveal,
 * not the generic no-bike value screen). Mirrors `BIKE_DEPENDENT_SCREENS` so the
 * value-payoff slot is filled for both cohorts (lean/invested only).
 */
const NO_BIKE_SCREENS: ReadonlySet<OnboardingRoute> = new Set([OB_SCREEN.NO_BIKE_VALUE]);

/** Screens the current bike-state routes past — bike-dependent when there's no
 * bike, no-bike-only when there is one. */
function isSkippedForBikeState(screen: OnboardingRoute, hasBike: boolean): boolean {
  return hasBike ? NO_BIKE_SCREENS.has(screen) : BIKE_DEPENDENT_SCREENS.has(screen);
}

/** Context for branch-aware navigation — derived from store state, not hardcoded. */
export interface OnboardingNavContext {
  /** Whether the rider captured a bike (full make+model OR make-level partial). */
  hasBike: boolean;
}

/**
 * Full route path for the screen after `current` in the flow. Bike state routes
 * around the wrong-cohort screens: when `ctx.hasBike` is false the bike-dependent
 * screens are skipped, when it's true the no-bike value screen is skipped.
 *
 * A `current` that is no longer in the flow resolves FORWARD to its recorded
 * successor rather than returning null — see RETIRED_SCREEN_SUCCESSOR. Without
 * that branch, every rider mid-flow on a removed step would resume into a dead
 * end the moment this ships as an OTA.
 *
 * The bike-state routing no longer exempts `control`. It used to, because control
 * was the V4 flow and had none of these screens; now every variant resolves to
 * the same flow, so exempting control would march a bike-less control user
 * straight into the Reveal, which has no bike to reveal.
 */
export function getNextRoute(
  variant: ObVariant,
  current: OnboardingRoute,
  ctx?: OnboardingNavContext,
): OnboardingRoutePath | null {
  const flow = ONBOARDING_FLOWS[variant];
  let idx = flow.indexOf(current);

  if (idx === -1) {
    const successor = RETIRED_SCREEN_SUCCESSOR[current];
    if (!successor) return null;
    // Land ON the successor (it was never completed), not after it. Re-enter
    // through this function so the successor itself is still subject to
    // bike-state skipping — a bike-less rider resuming from `maintenance` must
    // not be dropped onto the Commitment.
    if (ctx && isSkippedForBikeState(successor, ctx.hasBike)) {
      return getNextRoute(variant, successor, ctx);
    }
    return routeForScreen(successor);
  }

  if (idx >= flow.length - 1) return null;
  // Route past the screens the rider's bike-state pays off the other way:
  // bike-dependent screens when there's no bike, the no-bike value screen when
  // there is one.
  if (ctx) {
    while (idx < flow.length - 1 && isSkippedForBikeState(flow[idx + 1], ctx.hasBike)) {
      idx++;
    }
    if (idx >= flow.length - 1) return null;
  }
  return routeForScreen(flow[idx + 1]);
}

/** Given the last completed screen, return the full route path for the next screen */
export function getResumeRoute(
  variant: ObVariant,
  lastCompleted: OnboardingRoute,
  ctx?: OnboardingNavContext,
): OnboardingRoutePath | null {
  return getNextRoute(variant, lastCompleted, ctx);
}

/**
 * Full route path for the screen immediately before `current`, or null if it is
 * the first screen. Used as a fallback for Back when there is no navigation
 * history to pop (e.g. after resume-after-kill drops the user onto a mid-flow
 * screen) — `router.back()` would otherwise throw "GO_BACK was not handled".
 *
 * This used to skip an `AUTO_ADVANCE_SCREENS` set — screens that act on mount and
 * bounce the rider forward, so landing on one from Back created a loop. That set
 * held exactly two entries and BOTH are now gone from every flow: `paywall`
 * (removed in U6 — it re-presented the RevenueCat modal on mount, which is what
 * trapped riders in a paywall↔account loop) and `building-plan` (invested-only,
 * retired with the arm). The skip loop therefore had nothing left to skip, so it
 * is removed rather than left pointing at screens no flow contains.
 *
 * If a future step ever auto-advances on mount, reintroduce the set — do not
 * quietly rely on this being a plain decrement.
 */
export function getPreviousRoute(
  variant: ObVariant,
  current: OnboardingRoute,
): OnboardingRoutePath | null {
  const flow = ONBOARDING_FLOWS[variant];
  const currentIndex = flow.indexOf(current);
  if (currentIndex <= 0) {
    // First step, or a retired screen that is no longer in the flow at all —
    // in both cases there is no previous step to derive.
    return null;
  }
  return routeForScreen(flow[currentIndex - 1]);
}
