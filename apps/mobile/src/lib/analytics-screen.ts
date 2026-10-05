import type { JsonType } from '@posthog/core';

// -------------------------------------------------------------------
// Screen naming for PostHog `$screen` events
// -------------------------------------------------------------------
// CONVENTION: the screen name is the Expo Router *route template* — the file
// path under src/app, groups included, dynamic segments left as placeholders:
//
//   /(tabs)/(garage)/bike/[id]        not  /bike/3f9c…-uuid
//   /(modals)/ride-summary            not  /ride-summary
//   /                                 the root index
//
// It is built from `useSegments()`, so it is exactly the file that rendered and
// is stable across riders: one row per screen in PostHog, instead of one per
// bike / ride / article as the raw pathname produced. Groups stay in the name
// because they are what tells `(onboarding)/scan-receipt` apart from
// `(modals)/scan-receipt`. Renaming or moving a route file renames its screen.
//
// The ids the pathname used to carry are sent as `route_<param>` properties
// (allowlisted below — share tokens and usernames are deliberately dropped),
// and every screen carries a typed `feature_area` for per-feature breakdowns.
// -------------------------------------------------------------------

export const FEATURE_AREA = {
  RIDES: 'rides',
  GARAGE: 'garage',
  MAINTENANCE: 'maintenance',
  EXPENSES: 'expenses',
  DIAGNOSE: 'diagnose',
  LEARN: 'learn',
  DISCOVER: 'discover',
  PROFILE: 'profile',
  HOME: 'home',
  ONBOARDING: 'onboarding',
  AUTH: 'auth',
  PAYWALL: 'paywall',
  OTHER: 'other',
} as const;

export type FeatureArea = (typeof FEATURE_AREA)[keyof typeof FEATURE_AREA];

/**
 * Segment → feature area, in PRIORITY order: the first rule whose segment
 * appears anywhere in the route wins. The ordering is the whole design:
 *
 *  1. `paywall` beats its `(onboarding)` group — the paywall is its own funnel.
 *  2. `(onboarding)` / `(auth)` beat any screen inside them, so the onboarding
 *     receipt scan stays onboarding rather than expenses.
 *  3. Specific screens beat the tab they live in: `add-expense` under `(garage)`
 *     is expenses, `complete-task` is maintenance, `rides` under `(profile)` is
 *     rides.
 *  4. The tab group is the fallback for everything else in that tab.
 */
const FEATURE_AREA_RULES: readonly (readonly [segment: string, area: FeatureArea])[] = [
  ['paywall', FEATURE_AREA.PAYWALL],
  ['(onboarding)', FEATURE_AREA.ONBOARDING],
  ['(auth)', FEATURE_AREA.AUTH],

  // Expenses
  ['add-expense', FEATURE_AREA.EXPENSES],
  ['add-ride-expense', FEATURE_AREA.EXPENSES],
  ['expense-dashboard', FEATURE_AREA.EXPENSES],
  ['expense-detail', FEATURE_AREA.EXPENSES],
  ['scan-receipt', FEATURE_AREA.EXPENSES],

  // Maintenance
  ['add-maintenance-task', FEATURE_AREA.MAINTENANCE],
  ['edit-maintenance-task', FEATURE_AREA.MAINTENANCE],
  ['complete-task', FEATURE_AREA.MAINTENANCE],
  ['bike-tasks', FEATURE_AREA.MAINTENANCE],
  ['recalls', FEATURE_AREA.MAINTENANCE],

  // Rides
  ['start-ride', FEATURE_AREA.RIDES],
  ['ride-hud', FEATURE_AREA.RIDES],
  ['ride-summary', FEATURE_AREA.RIDES],
  ['ride-detail', FEATURE_AREA.RIDES],
  ['ride-flyover', FEATURE_AREA.RIDES],
  ['carplay', FEATURE_AREA.RIDES],
  ['rides', FEATURE_AREA.RIDES],
  ['heatmap', FEATURE_AREA.RIDES],
  ['ride', FEATURE_AREA.RIDES],

  // Trips / discover
  ['create-trip', FEATURE_AREA.DISCOVER],
  ['trip-detail', FEATURE_AREA.DISCOVER],
  ['create-group-ride', FEATURE_AREA.DISCOVER],
  ['group-ride-detail', FEATURE_AREA.DISCOVER],
  ['trips', FEATURE_AREA.DISCOVER],
  ['saved', FEATURE_AREA.DISCOVER],
  ['trip', FEATURE_AREA.DISCOVER],
  ['route', FEATURE_AREA.DISCOVER],
  ['routes', FEATURE_AREA.DISCOVER],
  ['t', FEATURE_AREA.DISCOVER],

  // Tab fallbacks
  ['(garage)', FEATURE_AREA.GARAGE],
  ['(diagnose)', FEATURE_AREA.DIAGNOSE],
  ['(learn)', FEATURE_AREA.LEARN],
  ['(discover)', FEATURE_AREA.DISCOVER],
  ['(profile)', FEATURE_AREA.PROFILE],
  ['(home)', FEATURE_AREA.HOME],
];

/**
 * Dynamic route params that may leave the device as `route_<name>`. Anything
 * not listed is dropped: `[token]` is a share-link credential and `[username]`
 * identifies another rider.
 */
const FORWARDED_ROUTE_PARAMS: readonly string[] = ['id', 'slug', 'country', 'region'];

const ROUTE_PARAM_PREFIX = 'route_';
const DYNAMIC_SEGMENT = /^\[(?:\.\.\.)?([^\]]+)\]$/;

/** `['(tabs)', '(garage)', 'bike', '[id]']` → `/(tabs)/(garage)/bike/[id]`. */
export function routeTemplateFromSegments(segments: readonly string[]): string {
  return `/${segments.join('/')}`;
}

export function featureAreaForSegments(segments: readonly string[]): FeatureArea {
  const present = new Set(segments);
  return FEATURE_AREA_RULES.find(([segment]) => present.has(segment))?.[1] ?? FEATURE_AREA.OTHER;
}

/** Param names of the dynamic segments in a route (`[id]` → `id`, `[...rest]` → `rest`). */
function dynamicParamNames(segments: readonly string[]): string[] {
  return segments.flatMap((segment) => {
    const match = DYNAMIC_SEGMENT.exec(segment);
    return match ? [match[1]] : [];
  });
}

/** The allowlisted dynamic ids of the current route, as `route_<name>` properties. */
export function routeParamProperties(
  segments: readonly string[],
  params: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    dynamicParamNames(segments)
      .filter((name) => FORWARDED_ROUTE_PARAMS.includes(name))
      .flatMap((name) => {
        const value = params[name];
        const flat = Array.isArray(value) ? value.join('/') : value;
        return flat ? [[`${ROUTE_PARAM_PREFIX}${name}`, flat]] : [];
      }),
  );
}

export interface ScreenView {
  name: string;
  properties: Record<string, JsonType>;
}

/** Everything one `$screen` event carries, derived from the router state. */
export function buildScreenView(
  segments: readonly string[],
  params: Readonly<Record<string, string | string[] | undefined>>,
  previousScreen: string | null,
): ScreenView {
  return {
    name: routeTemplateFromSegments(segments),
    properties: {
      feature_area: featureAreaForSegments(segments),
      previous_screen: previousScreen,
      ...routeParamProperties(segments, params),
    },
  };
}

/**
 * Identity of a screen view for de-duplication: the route template plus the
 * pathname. The pathname alone is not enough — Expo Router drops `(group)`
 * segments and a trailing `index`, so every tab root is `/`.
 */
export function screenKeyFor(segments: readonly string[], pathname: string): string {
  return `${routeTemplateFromSegments(segments)}|${pathname}`;
}
