/**
 * Type-safe route constants for the entire app.
 * Use these instead of magic strings in router.push / router.replace / deepLink.
 */

/** Main tab routes */
export const TAB_ROUTE = {
  HOME: '/(tabs)/(home)',
  DISCOVER: '/(tabs)/(discover)',
  GARAGE: '/(tabs)/(garage)',
  PROFILE: '/(tabs)/(profile)',
} as const;

/** Home sub-routes: Home's own copies of garage sheets, so they close back to Home. */
export const HOME_ROUTE = {
  ADD_BIKE: '/(tabs)/(home)/add-bike',
} as const;

/** Garage sub-routes */
export const GARAGE_ROUTE = {
  EXPENSE_DASHBOARD: '/(tabs)/(garage)/expense-dashboard',
  ADD_EXPENSE: '/(tabs)/(garage)/add-expense',
  ADD_BIKE: '/(tabs)/(garage)/add-bike',
} as const;

/** Root modal routes (presented over any tab / onboarding stack) */
export const MODAL_ROUTE = {
  SCAN_RECEIPT: '/(modals)/scan-receipt',
  /** The modal stack's copy of add-bike, opened over receipt scan. */
  ADD_BIKE: '/(modals)/add-bike',
} as const;

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
  /** The old heatmap route, kept as a redirect for links and deep links. */
  LEGACY_HEATMAP: 'legacy_heatmap',
  /** No entry param (a deep link or a route not yet passing one). */
  UNKNOWN: 'unknown',
} as const;

export type RiderInsightsEntry = (typeof RIDER_INSIGHTS_ENTRY)[keyof typeof RIDER_INSIGHTS_ENTRY];

/** The `[group]` of a Rider insights detail page. */
export const RIDER_INSIGHTS_DETAIL_GROUP = {
  ROAD_CHARACTER: 'road-character',
  TERRITORY: 'territory',
  RHYTHM: 'rhythm',
  BEST_RIDES: 'best-rides',
  BIKES: 'bikes',
  COUNTRIES: 'countries',
} as const;

export type RiderInsightsDetailGroup =
  (typeof RIDER_INSIGHTS_DETAIL_GROUP)[keyof typeof RIDER_INSIGHTS_DETAIL_GROUP];
