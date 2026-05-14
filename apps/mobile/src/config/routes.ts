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
  RIDER_PROFILE: '/(tabs)/(profile)/rider-profile',
} as const;
