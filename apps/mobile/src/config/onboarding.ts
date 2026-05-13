export const ONBOARDING_SCREENS = [
  { route: 'index' },
  { route: 'experience' },
  { route: 'goals' },
  { route: 'bike-setup' },
  { route: 'maintenance' },
  { route: 'paywall' },
  { route: 'notifications' },
  { route: 'personalizing' },
] as const;

export type OnboardingRoute = (typeof ONBOARDING_SCREENS)[number]['route'];
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
