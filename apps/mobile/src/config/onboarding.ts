export const ONBOARDING_SCREENS = [
  { route: 'index', key: 'welcome', section: 'A', canSkip: false },
  { route: 'rider-type', key: 'riderType', section: 'A', canSkip: false },
  { route: 'your-bike', key: 'yourBike', section: 'B', canSkip: true },
  { route: 'bike-photo', key: 'bikePhoto', section: 'B', canSkip: true },
  { route: 'preferences', key: 'preferences', section: 'C', canSkip: false },
  { route: 'goals', key: 'goals', section: 'C', canSkip: false },
  { route: 'notifications', key: 'notifications', section: 'C', canSkip: true },
  { route: 'building', key: 'building', section: 'D', canSkip: false },
  { route: 'paywall', key: 'paywall', section: 'D', canSkip: true },
  { route: 'welcome-home', key: 'welcomeHome', section: 'D', canSkip: false },
] as const;

export type OnboardingRoute = (typeof ONBOARDING_SCREENS)[number]['route'];
export type OnboardingScreenKey = (typeof ONBOARDING_SCREENS)[number]['key'];
export const TOTAL_SCREENS = ONBOARDING_SCREENS.length;

/** Get the 0-based index of a screen by route name */
export function getScreenIndex(route: OnboardingRoute): number {
  const index = ONBOARDING_SCREENS.findIndex((s) => s.route === route);
  return index >= 0 ? index : 0;
}
