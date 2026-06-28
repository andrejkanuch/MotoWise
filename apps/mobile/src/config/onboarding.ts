/**
 * Onboarding A/B experiment (2026) — PostHog multivariate flag key + variants.
 * `lean` (A) and `invested` (B) are the test arms; `control` maps to the
 * pre-test V4 flow and doubles as the safe degradation when the flag is
 * disabled or returns an unknown value.
 */
export const EXPERIMENT_FLAG_KEY = 'onboarding_ab_2026';

export const OB_VARIANT = {
  LEAN: 'lean',
  INVESTED: 'invested',
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
  WELCOME: 'index',
  EXPERIENCE: 'experience',
  GOALS: 'goals',
  BIKE_SETUP: 'bike-setup',
  MAINTENANCE: 'maintenance',
  PAYWALL: 'paywall',
  NOTIFICATIONS: 'notifications',
  PERSONALIZING: 'personalizing',
  // A/B 2026 — shared new steps (lean + invested)
  REVEAL: 'reveal',
  COMMITMENT: 'commitment',
  ACCOUNT: 'account',
  // Attribution — "How did you hear about us?" (post-paywall, all variants)
  HEARD_ABOUT: 'heard-about',
  // A/B 2026 — invested-only profiling + loader
  FREQUENCY: 'frequency',
  STAY_ON_TOP: 'stay-on-top',
  LAST_SERVICE: 'last-service',
  BUILDING_PLAN: 'building-plan',
  // Standalone (not a flow step): returning-user sign-in, entered from
  // Welcome "Log in" and the paywall's "Already have an account?".
  SIGN_IN: 'sign-in',
} as const;

export type OnboardingRoute = (typeof OB_SCREEN)[keyof typeof OB_SCREEN];

/**
 * Ordered flows per experiment variant — drive the progress index, resume
 * target, Back fallback, and forward navigation.
 *
 * control  = pre-test V4 flow (auth-first, unchanged).
 * lean (A) = value-first short path: bike is the first real action, paid off
 *            by the Reveal; 1-tap Commitment; paywall on day 0; account after.
 * invested (B) = same restructure plus profiling questions, a "building your
 *            plan" loader, a projection-led Reveal, and a hold-to-commit.
 */
const V4_FLOW = [
  OB_SCREEN.WELCOME,
  OB_SCREEN.EXPERIENCE,
  OB_SCREEN.GOALS,
  OB_SCREEN.BIKE_SETUP,
  OB_SCREEN.MAINTENANCE,
  OB_SCREEN.PAYWALL,
  OB_SCREEN.HEARD_ABOUT,
  OB_SCREEN.NOTIFICATIONS,
  OB_SCREEN.PERSONALIZING,
] as const satisfies ReadonlyArray<OnboardingRoute>;

const LEAN_FLOW = [
  OB_SCREEN.WELCOME,
  OB_SCREEN.EXPERIENCE,
  OB_SCREEN.BIKE_SETUP,
  OB_SCREEN.REVEAL,
  OB_SCREEN.GOALS,
  OB_SCREEN.MAINTENANCE,
  OB_SCREEN.COMMITMENT,
  OB_SCREEN.PAYWALL,
  OB_SCREEN.ACCOUNT,
  OB_SCREEN.HEARD_ABOUT,
  OB_SCREEN.NOTIFICATIONS,
  OB_SCREEN.PERSONALIZING,
] as const satisfies ReadonlyArray<OnboardingRoute>;

const INVESTED_FLOW = [
  OB_SCREEN.WELCOME,
  OB_SCREEN.EXPERIENCE,
  OB_SCREEN.FREQUENCY,
  OB_SCREEN.STAY_ON_TOP,
  OB_SCREEN.LAST_SERVICE,
  OB_SCREEN.BIKE_SETUP,
  OB_SCREEN.BUILDING_PLAN,
  OB_SCREEN.REVEAL,
  OB_SCREEN.GOALS,
  OB_SCREEN.MAINTENANCE,
  OB_SCREEN.COMMITMENT,
  OB_SCREEN.PAYWALL,
  OB_SCREEN.ACCOUNT,
  OB_SCREEN.HEARD_ABOUT,
  OB_SCREEN.NOTIFICATIONS,
  OB_SCREEN.PERSONALIZING,
] as const satisfies ReadonlyArray<OnboardingRoute>;

export const ONBOARDING_FLOWS: Record<ObVariant, ReadonlyArray<OnboardingRoute>> = {
  [OB_VARIANT.CONTROL]: V4_FLOW,
  [OB_VARIANT.LEAN]: LEAN_FLOW,
  [OB_VARIANT.INVESTED]: INVESTED_FLOW,
};

/**
 * Legacy V4 flow length — referenced only by the retired V1 screens, which are
 * unreachable but still compile. Active screens derive their progress via
 * `useOnboardingStep` (variant-aware). Do not use in new code.
 */
export const TOTAL_SCREENS = V4_FLOW.length;

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
  [OB_SCREEN.COMMITMENT]: 'commitment',
  [OB_SCREEN.ACCOUNT]: 'account',
  [OB_SCREEN.HEARD_ABOUT]: 'heard_about',
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
  COMMITMENT: '/(onboarding)/commitment',
  ACCOUNT: '/(onboarding)/account',
  HEARD_ABOUT: '/(onboarding)/heard-about',
  FREQUENCY: '/(onboarding)/frequency',
  STAY_ON_TOP: '/(onboarding)/stay-on-top',
  LAST_SERVICE: '/(onboarding)/last-service',
  BUILDING_PLAN: '/(onboarding)/building-plan',
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
 * Screens that only pay off when the rider has a bike. When there's no bike,
 * the lean/invested flows route *around* them (spec §4): a true bike-skip goes
 * straight to `goals` (no Reveal to pay off), and `goals` jumps to `paywall`
 * (no Maintenance/Commitment to build a plan for).
 */
const BIKE_DEPENDENT_SCREENS: ReadonlySet<OnboardingRoute> = new Set([
  OB_SCREEN.REVEAL,
  OB_SCREEN.MAINTENANCE,
  OB_SCREEN.COMMITMENT,
]);

/** Context for branch-aware navigation — derived from store state, not hardcoded. */
export interface OnboardingNavContext {
  /** Whether the rider captured a bike (full make+model OR make-level partial). */
  hasBike: boolean;
}

/**
 * Full route path for the screen after `current` in the variant's flow. When
 * `ctx.hasBike` is false, bike-dependent screens are skipped (lean/invested
 * only — `control` is the untouched V4 flow and ignores the branch).
 */
export function getNextRoute(
  variant: ObVariant,
  current: OnboardingRoute,
  ctx?: OnboardingNavContext,
): OnboardingRoutePath | null {
  const flow = ONBOARDING_FLOWS[variant];
  let idx = flow.indexOf(current);
  if (idx === -1 || idx >= flow.length - 1) return null;
  if (ctx && !ctx.hasBike && variant !== OB_VARIANT.CONTROL) {
    while (idx < flow.length - 1 && BIKE_DEPENDENT_SCREENS.has(flow[idx + 1])) {
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
 * Auto-advancing loader screens that must never be a Back target: re-entering
 * one re-runs its timer and bounces the user forward again (a building-plan↔
 * reveal loop). Back skips over them to the previous real step. (Forward nav
 * already replaces past them — see BuildingPlanScreen's `goNext({ replace })`.)
 */
const AUTO_ADVANCE_SCREENS: ReadonlySet<OnboardingRoute> = new Set([OB_SCREEN.BUILDING_PLAN]);

/**
 * Full route path for the screen immediately before `current`, or null if it is
 * the first screen. Used as a fallback for Back when there is no navigation
 * history to pop (e.g. after resume-after-kill drops the user onto a mid-flow
 * screen) — `router.back()` would otherwise throw "GO_BACK was not handled".
 * Skips auto-advancing loader screens so Back never lands on one.
 */
export function getPreviousRoute(
  variant: ObVariant,
  current: OnboardingRoute,
): OnboardingRoutePath | null {
  const flow = ONBOARDING_FLOWS[variant];
  const currentIndex = flow.indexOf(current);

  // Walk backward to the nearest real step, skipping auto-advance loaders.
  for (let i = currentIndex - 1; i >= 0; i--) {
    const screen = flow[i];
    if (!AUTO_ADVANCE_SCREENS.has(screen)) return routeForScreen(screen);
  }

  // First step, or only loaders precede it — nothing to go back to.
  return null;
}
