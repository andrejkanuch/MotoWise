import { PAYWALL_TRIGGER } from '@/lib/paywall-session';

/** Which list the follower screen opens on (`tab` search param). */
export const FOLLOW_LIST_TAB = {
  FOLLOWERS: 'followers',
  FOLLOWING: 'following',
} as const;
export type FollowListTab = (typeof FOLLOW_LIST_TAB)[keyof typeof FOLLOW_LIST_TAB];

/** App settings that open the pushed single-choice list (`preference/[key]`). */
export const APP_PREFERENCE_KEY = {
  LANGUAGE: 'language',
  THEME: 'theme',
  UNITS: 'units',
  CURRENCY: 'currency',
  RIDE_MAP: 'ride-map',
} as const;
export type AppPreferenceKey = (typeof APP_PREFERENCE_KEY)[keyof typeof APP_PREFERENCE_KEY];

/** Public legal pages on the web app (apps/web/src/app/[locale]/(marketing)). */
export const LEGAL_URL = {
  TERMS: 'https://motovault.app/terms',
  PRIVACY: 'https://motovault.app/privacy',
} as const;

/**
 * The paywall behind the Subscription section's Upgrade row: the rider asked for
 * it, so its events carry `trigger: 'rider_tap'` (issue 365 T05a).
 */
export const PROFILE_UPGRADE_PAYWALL = {
  source: 'profile',
  feature: 'subscription',
  surface: 'profile_subscriptions_row',
  trigger: PAYWALL_TRIGGER.RIDER_TAP,
} as const;
