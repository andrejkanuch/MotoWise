export const ONBOARDING_STEPS = [
  { route: 'index', key: 'welcome' },
  { route: 'select-bike', key: 'bike' },
  { route: 'riding-habits', key: 'habits' },
  { route: 'learning-preferences', key: 'learning' },
  { route: 'insights', key: 'insights' },
  { route: 'paywall', key: 'paywall' },
  { route: 'personalizing', key: 'personalizing' },
] as const;

export type OnboardingStepName = (typeof ONBOARDING_STEPS)[number]['key'];
export const TOTAL_STEPS = ONBOARDING_STEPS.length;
