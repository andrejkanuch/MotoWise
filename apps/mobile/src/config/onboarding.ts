/**
 * Onboarding screen identifiers (route segment names) — the single source of
 * truth. Use these constants instead of magic strings anywhere a screen is
 * referenced (resume tracking, Back fallback, progress index).
 */
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

export const OB_SCREEN = {
  WELCOME: 'index',
  EXPERIENCE: 'experience',
  GOALS: 'goals',
  BIKE_SETUP: 'bike-setup',
  MAINTENANCE: 'maintenance',
  PAYWALL: 'paywall',
  NOTIFICATIONS: 'notifications',
  PERSONALIZING: 'personalizing',
} as const;

export type OnboardingRoute = (typeof OB_SCREEN)[keyof typeof OB_SCREEN];

/** Ordered flow — drives the progress index, resume target, and Back fallback. */
export const ONBOARDING_SCREENS = [
  { route: OB_SCREEN.WELCOME },
  { route: OB_SCREEN.EXPERIENCE },
  { route: OB_SCREEN.GOALS },
  { route: OB_SCREEN.BIKE_SETUP },
  { route: OB_SCREEN.MAINTENANCE },
  { route: OB_SCREEN.PAYWALL },
  { route: OB_SCREEN.NOTIFICATIONS },
  { route: OB_SCREEN.PERSONALIZING },
] as const satisfies ReadonlyArray<{ route: OnboardingRoute }>;

export const TOTAL_SCREENS = ONBOARDING_SCREENS.length;

/** Type-safe onboarding route paths for router.push / router.replace */
export const OB_ROUTE = {
  EXPERIENCE: '/(onboarding)/experience',
  GOALS: '/(onboarding)/goals',
  BIKE_SETUP: '/(onboarding)/bike-setup',
  MAINTENANCE: '/(onboarding)/maintenance',
  PAYWALL: '/(onboarding)/paywall',
  NOTIFICATIONS: '/(onboarding)/notifications',
  PERSONALIZING: '/(onboarding)/personalizing',
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

/** Map primary goal to RevenueCat placement string */
export const GOAL_TO_PLACEMENT: Record<string, string> = {
  track_rides: 'onboarding_rides',
  manage_expenses: 'onboarding_rides',
  discover_routes: 'onboarding_routes',
  maintain_bike: 'onboarding_rides',
  just_exploring: 'onboarding_default',
} as const;

type OnboardingRoutePath = `/(onboarding)/${OnboardingRoute}`;

/** Given the last completed screen, return the full route path for the next screen */
export function getResumeRoute(lastCompleted: OnboardingRoute): OnboardingRoutePath | null {
  const idx = ONBOARDING_SCREENS.findIndex((s) => s.route === lastCompleted);
  if (idx === -1 || idx >= ONBOARDING_SCREENS.length - 1) return null;
  const nextRoute = ONBOARDING_SCREENS[idx + 1].route;
  return `/(onboarding)/${nextRoute}`;
}

/**
 * Full route path for the screen immediately before `current`, or null if it is
 * the first screen. Used as a fallback for Back when there is no navigation
 * history to pop (e.g. after resume-after-kill drops the user onto a mid-flow
 * screen) — `router.back()` would otherwise throw "GO_BACK was not handled".
 */
export function getPreviousRoute(current: OnboardingRoute): OnboardingRoutePath | null {
  const idx = ONBOARDING_SCREENS.findIndex((s) => s.route === current);
  if (idx <= 0) return null;
  return `/(onboarding)/${ONBOARDING_SCREENS[idx - 1].route}`;
}
