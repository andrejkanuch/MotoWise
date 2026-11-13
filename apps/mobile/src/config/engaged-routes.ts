/**
 * S3 "day-2 engaged return" (issue 365, board/06 F14): a day-2 `$screen`
 * counts as engaged unless its `$screen_name` is one of these names or starts
 * with one of the prefixes (home, What's New, onboarding and sign-in). The S3
 * SQL (board/06 Appendix B, T02) reads this list; the baseline 37/367 was
 * computed with exactly it, so change it only together with that SQL.
 *
 * Both name formats appear in the data: the route template (`/(tabs)/(home)`,
 * lib/analytics-screen.ts, from 2026-10-05) and the bare pathname older builds
 * sent (`/goals`, where every tab root was `/`). `config/__tests__/engaged-routes.test.ts`
 * fails when a listed name no longer matches a route file.
 */
export const NON_ENGAGED_SCREEN_NAMES = [
  // Home
  '/',
  '/(tabs)/(home)',
  '/(tabs)',
  // What's New
  '/whats-new',
  '/(modals)/whats-new',
  // Onboarding and sign-in, pathname format
  '/login',
  '/account',
  '/commitment',
  '/goals',
  '/reveal',
  '/bike-setup',
  '/personalizing',
  '/notifications',
  '/paywall',
  '/heard-about',
  '/experience',
  '/no-bike-value',
] as const;

/** Any route inside these groups (template format) is onboarding or sign-in. */
export const NON_ENGAGED_SCREEN_PREFIXES = ['/(onboarding)', '/(auth)'] as const;

/**
 * Names old builds sent by hand, before screens were named after route files.
 * No route file has them, so the route test cannot check them; it checks
 * instead that none comes back as a route.
 */
export const NON_ENGAGED_LEGACY_SCREEN_NAMES = ['/welcome', '/consent'] as const;

const NON_ENGAGED: ReadonlySet<string> = new Set([
  ...NON_ENGAGED_SCREEN_NAMES,
  ...NON_ENGAGED_LEGACY_SCREEN_NAMES,
]);

/** Whether a `$screen_name` seen on day 2 makes the return "engaged" (F14). */
export function isEngagedScreenName(name: string): boolean {
  if (NON_ENGAGED.has(name)) return false;
  return !NON_ENGAGED_SCREEN_PREFIXES.some((prefix) => name.startsWith(prefix));
}
