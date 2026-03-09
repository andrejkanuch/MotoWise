export const ONBOARDING_SCREENS = [
  { route: 'index', key: 'welcome', section: 'A', canSkip: false },
  { route: 'experience', key: 'experience', section: 'A', canSkip: false },
  { route: 'bike-year', key: 'bikeYear', section: 'B', canSkip: true },
  { route: 'bike-make', key: 'bikeMake', section: 'B', canSkip: false },
  { route: 'bike-model', key: 'bikeModel', section: 'B', canSkip: false },
  { route: 'bike-type', key: 'bikeType', section: 'B', canSkip: false },
  { route: 'bike-mileage', key: 'bikeMileage', section: 'B', canSkip: false },
  { route: 'bike-photo', key: 'bikePhoto', section: 'B', canSkip: false },
  { route: 'riding-frequency', key: 'ridingFrequency', section: 'C', canSkip: false },
  { route: 'riding-goals', key: 'ridingGoals', section: 'C', canSkip: false },
  { route: 'maintenance-style', key: 'maintenanceStyle', section: 'C', canSkip: false },
  { route: 'repair-spending', key: 'repairSpending', section: 'C', canSkip: false },
  { route: 'learning-preferences', key: 'learningPreferences', section: 'D', canSkip: false },
  { route: 'smart-maintenance', key: 'smartMaintenance', section: 'D', canSkip: false },
  { route: 'insights', key: 'insights', section: 'E', canSkip: false },
  { route: 'paywall', key: 'paywall', section: 'E', canSkip: false },
  { route: 'personalizing', key: 'personalizing', section: 'E', canSkip: false },
] as const;

export type OnboardingScreenKey = (typeof ONBOARDING_SCREENS)[number]['key'];
export const TOTAL_SCREENS = ONBOARDING_SCREENS.length;

// Keep backwards compatibility for existing imports
export const ONBOARDING_STEPS = ONBOARDING_SCREENS;
export const TOTAL_STEPS = TOTAL_SCREENS;

/** Get the 0-based index of a screen by route name */
export function getScreenIndex(route: string): number {
  const index = ONBOARDING_SCREENS.findIndex((s) => s.route === route);
  return index >= 0 ? index : 0;
}
