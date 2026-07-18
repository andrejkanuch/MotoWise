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

/** Garage sub-routes */
export const GARAGE_ROUTE = {
  EXPENSE_DASHBOARD: '/(tabs)/(garage)/expense-dashboard',
  ADD_EXPENSE: '/(tabs)/(garage)/add-expense',
  ADD_BIKE: '/(tabs)/(garage)/add-bike',
} as const;

/** Root modal routes (presented over any tab / onboarding stack) */
export const MODAL_ROUTE = {
  SCAN_RECEIPT: '/(modals)/scan-receipt',
} as const;

/** Profile sub-routes */
export const PROFILE_ROUTE = {
  RIDES: '/(tabs)/(profile)/rides',
  TRIPS: '/(tabs)/(profile)/trips',
  SAVED: '/(tabs)/(profile)/saved',
  HEATMAP: '/(tabs)/(profile)/heatmap',
  SETTINGS: '/(tabs)/(profile)/settings',
  NOTIFICATIONS: '/(tabs)/(profile)/notifications',
  SUPPORT: '/(tabs)/(profile)/support',
  PRIVACY: '/(tabs)/(profile)/privacy',
  UPGRADE: '/(tabs)/(profile)/upgrade',
  EDIT_PROFILE: '/(tabs)/(profile)/edit-profile',
} as const;
