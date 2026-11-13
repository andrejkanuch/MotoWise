/**
 * Type-safe route constants for the entire app.
 * Use these instead of magic strings in router.push / router.replace / deepLink.
 */

import { DIAGNOSTIC_ENTRY, DIAGNOSTIC_ENTRY_PARAM } from './diagnostic-entry';
import { WHATS_NEW_SOURCE, type WhatsNewSource } from './whats-new';

/** Main tab routes */
export const TAB_ROUTE = {
  HOME: '/(tabs)/(home)',
  DISCOVER: '/(tabs)/(discover)',
  GARAGE: '/(tabs)/(garage)',
  PROFILE: '/(tabs)/(profile)',
} as const;

/**
 * Home sub-routes: Home's own copies of garage sheets, so they close back to
 * Home, and of Rider insights, so its back button returns to Home.
 */
export const HOME_ROUTE = {
  ADD_BIKE: '/(tabs)/(home)/add-bike',
  /** Under `home/` so its URL never collides with Profile's: links keep opening Profile's copy. */
  RIDER_INSIGHTS: '/(tabs)/(home)/home/rider-insights',
  RIDER_INSIGHTS_DETAIL: '/(tabs)/(home)/home/rider-insights/[group]',
  RIDER_INSIGHTS_RECAP: '/(tabs)/(home)/home/rider-insights/recap',
} as const;

// Issue 365 T05b
/** The diagnose list opened by Home's "Diagnose" tool, so its Start counts as `home_tool`. */
export function diagnoseListFromHomeHref() {
  return {
    pathname: '/(tabs)/(diagnose)',
    params: { [DIAGNOSTIC_ENTRY_PARAM]: DIAGNOSTIC_ENTRY.HOME_TOOL },
  } as const;
}

/** Garage sub-routes */
export const GARAGE_ROUTE = {
  EXPENSE_DASHBOARD: '/(tabs)/(garage)/expense-dashboard',
  ADD_EXPENSE: '/(tabs)/(garage)/add-expense',
  ADD_BIKE: '/(tabs)/(garage)/add-bike',
  /** A bike's notes; pass `{ motorcycleId, from? }`. */
  NOTES: '/(tabs)/(garage)/notes',
  /** Edit a bike; open it with `editBikeHref`. */
  EDIT_BIKE: '/(tabs)/(garage)/edit-bike',
} as const;

/** Where the bike editor was opened from: `source` on `garage_bike_edited` (issue 365 T05d). */
export const BIKE_EDIT_SOURCE = {
  BIKE_HUB: 'bike_hub',
  GARAGE_LIST: 'garage_list',
  EXPENSE_DASHBOARD: 'expense_dashboard',
  /** A missing or unknown `source` param. */
  OTHER: 'other',
} as const;
export type BikeEditSource = (typeof BIKE_EDIT_SOURCE)[keyof typeof BIKE_EDIT_SOURCE];

/** The bike editor for bike `id`, opened from `source`, for `router.push`. */
export function editBikeHref(id: string, source: BikeEditSource) {
  return { pathname: GARAGE_ROUTE.EDIT_BIKE, params: { id, source } };
}

/**
 * The `from` param of a feature screen opened by a What's New page. With it,
 * and while that visit is open, the screen offers the way back to What's New.
 */
export const FROM_WHATS_NEW = 'whats-new';

/** Root modal routes (presented over any tab / onboarding stack) */
export const MODAL_ROUTE = {
  SCAN_RECEIPT: '/(modals)/scan-receipt',
  /** The modal stack's copy of add-bike, opened over receipt scan. */
  ADD_BIKE: '/(modals)/add-bike',
  /** What's New; pass `{ source: WhatsNewSource }`. */
  WHATS_NEW: '/(modals)/whats-new',
  /** A bike's safety recalls; pass `{ motorcycleId, bikeName? }`. */
  RECALLS: '/(modals)/recalls',
  /** "Service plan ready" over Home after onboarding; pass `{ motorcycleId, bikeName? }`. */
  SERVICE_PLAN_READY: '/(modals)/service-plan-ready',
  /** Start Ride. Opening "the ride" from a tap goes through `features/ride/ride-route.ts`. */
  START_RIDE: '/(modals)/start-ride',
} as const;

/** The What's New route opened from `source`, for `router.push`. */
export function whatsNewHref(source: WhatsNewSource) {
  return { pathname: MODAL_ROUTE.WHATS_NEW, params: { source } };
}

/** What's New reopened from a feature screen on page `page`, without the boot. */
export function whatsNewReturnHref(page: number) {
  return {
    pathname: MODAL_ROUTE.WHATS_NEW,
    params: { source: WHATS_NEW_SOURCE.RETURN, resume: String(page), noBoot: '1' },
  };
}

/** Profile sub-routes */
export const PROFILE_ROUTE = {
  INDEX: '/(tabs)/(profile)',
  RIDES: '/(tabs)/(profile)/rides',
  TRIPS: '/(tabs)/(profile)/trips',
  SAVED: '/(tabs)/(profile)/saved',
  /** Old "Roads I've ridden" screen; redirects to Rider insights. */
  HEATMAP: '/(tabs)/(profile)/heatmap',
  /** Rider insights; pass `{ entry: RiderInsightsEntry }`. */
  RIDER_INSIGHTS: '/(tabs)/(profile)/rider-insights',
  /** One insight on its own page; pass `{ group: RiderInsightsDetailGroup }`. */
  RIDER_INSIGHTS_DETAIL: '/(tabs)/(profile)/rider-insights/[group]',
  /** The season recap: seven story cards to keep or post. */
  RIDER_INSIGHTS_RECAP: '/(tabs)/(profile)/rider-insights/recap',
  APP_SETTINGS: '/(tabs)/(profile)/app-settings',
  /** Pushed single-choice list for one app setting; pass `{ key: AppPreferenceKey }`. */
  PREFERENCE: '/(tabs)/(profile)/preference/[key]',
  NOTIFICATIONS: '/(tabs)/(profile)/notifications',
  SUPPORT: '/(tabs)/(profile)/support',
  /** "Write to the developer" form. */
  FEEDBACK: '/(tabs)/(profile)/feedback',
  PRIVACY: '/(tabs)/(profile)/privacy',
  EDIT_PROFILE: '/(tabs)/(profile)/edit-profile',
  /** Profile's own copy of the garage add-bike sheet (closes back to Profile). */
  ADD_BIKE: '/(tabs)/(profile)/add-bike',
  /** Rider's public profile; pass `{ username }`. */
  RIDER: '/(tabs)/(profile)/rider/[username]',
  /** Follower / following lists; pass `{ userId, tab?: FollowListTab }`. */
  FOLLOWERS: '/(tabs)/(profile)/rider/followers',
} as const;

/** Where Rider insights was opened from; sent as the `entry` route param and on the open event. */
export const RIDER_INSIGHTS_ENTRY = {
  HOME: 'home',
  MY_RIDES: 'my_rides',
  PROFILE: 'profile',
  RIDE_SUMMARY: 'ride_summary',
  /** A What's New page's button. Not a use of the feature: the NEW chip stays. */
  WHATS_NEW: 'whats_new',
  /** The old heatmap route, kept as a redirect for links and deep links. */
  LEGACY_HEATMAP: 'legacy_heatmap',
  /** No entry param (a deep link or a route not yet passing one). */
  UNKNOWN: 'unknown',
} as const;

export type RiderInsightsEntry = (typeof RIDER_INSIGHTS_ENTRY)[keyof typeof RIDER_INSIGHTS_ENTRY];

/** The tab stacks that hold a copy of Rider insights and its pages. */
export const RIDER_INSIGHTS_STACK = {
  HOME: {
    MAIN: HOME_ROUTE.RIDER_INSIGHTS,
    DETAIL: HOME_ROUTE.RIDER_INSIGHTS_DETAIL,
    RECAP: HOME_ROUTE.RIDER_INSIGHTS_RECAP,
  },
  PROFILE: {
    MAIN: PROFILE_ROUTE.RIDER_INSIGHTS,
    DETAIL: PROFILE_ROUTE.RIDER_INSIGHTS_DETAIL,
    RECAP: PROFILE_ROUTE.RIDER_INSIGHTS_RECAP,
  },
} as const;

export type RiderInsightsStack = (typeof RIDER_INSIGHTS_STACK)[keyof typeof RIDER_INSIGHTS_STACK];

/**
 * The Rider insights route opened from `entry`, for `router.push`. Home opens
 * its own stack's copy so back returns to Home; every other entry opens Profile's.
 */
export function riderInsightsHref(entry: RiderInsightsEntry) {
  const stack =
    entry === RIDER_INSIGHTS_ENTRY.HOME ? RIDER_INSIGHTS_STACK.HOME : RIDER_INSIGHTS_STACK.PROFILE;
  return { pathname: stack.MAIN, params: { entry } };
}

/** The `[group]` of a Rider insights detail page. */
export const RIDER_INSIGHTS_DETAIL_GROUP = {
  ROAD_CHARACTER: 'road-character',
  TERRITORY: 'territory',
  RHYTHM: 'rhythm',
  BEST_RIDES: 'best-rides',
  BIKES: 'bikes',
  COUNTRIES: 'countries',
  /** The season's months and weeks ridden; free, like the ribbon it opens from. */
  SEASON: 'season',
} as const;

export type RiderInsightsDetailGroup =
  (typeof RIDER_INSIGHTS_DETAIL_GROUP)[keyof typeof RIDER_INSIGHTS_DETAIL_GROUP];
