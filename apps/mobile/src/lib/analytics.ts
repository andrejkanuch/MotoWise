import type { JsonType } from '@posthog/core';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

// -------------------------------------------------------------------
// Analytics & Crash Reporting Wrapper
// -------------------------------------------------------------------
// Wraps Sentry (crash reporting) and PostHog (product analytics) with
// a privacy-respecting layer. Both SDKs are disabled by default if no
// DSN / API key is configured, and they respect the user's privacy
// toggle settings from the Privacy screen.
// -------------------------------------------------------------------

const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn ?? '';
const POSTHOG_API_KEY = Constants.expoConfig?.extra?.posthogApiKey ?? '';
const POSTHOG_HOST = Constants.expoConfig?.extra?.posthogHost ?? 'https://eu.i.posthog.com';

// Eagerly initialize PostHog so the instance can be passed to PostHogProvider.
// The client is disabled when no API key is configured, so events are no-ops.
export const posthogClient: PostHog = new PostHog(POSTHOG_API_KEY || 'placeholder', {
  host: POSTHOG_HOST,
  enableSessionReplay: false,
  disabled: !POSTHOG_API_KEY,
});

let analyticsEnabled = true;
let crashReportingEnabled = true;

export function isAnalyticsEnabled() {
  return analyticsEnabled;
}

// ---- Initialisation ------------------------------------------------

export const sentryNavigationIntegration: ReturnType<typeof Sentry.reactNavigationIntegration> =
  Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
  });

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enabled: !__DEV__,
    enableAutoSessionTracking: true,
    attachScreenshot: true,
    debug: false,
    integrations: [sentryNavigationIntegration],
  });
}

export function initPostHog() {
  // Client is initialized eagerly at module load time; this is a no-op kept for backwards compatibility.
}

// ---- Privacy Controls -----------------------------------------------

export function setAnalyticsEnabled(enabled: boolean) {
  analyticsEnabled = enabled;
  if (!enabled && posthogClient) {
    posthogClient.optOut();
  } else if (enabled && posthogClient) {
    posthogClient.optIn();
  }
}

export function setCrashReportingEnabled(enabled: boolean) {
  crashReportingEnabled = enabled;
  if (SENTRY_DSN) {
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = enabled;
    }
  }
}

// ---- User Identification (anonymous) --------------------------------

export function identifyUser(userId: string) {
  if (analyticsEnabled && posthogClient) {
    posthogClient.identify(userId);
  }
  if (crashReportingEnabled && SENTRY_DSN) {
    Sentry.setUser({ id: userId });
  }
}

export function resetUser() {
  if (posthogClient) {
    posthogClient.reset();
  }
  if (SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

// ---- Event Tracking -------------------------------------------------

export const AnalyticsEvent = {
  // Auth
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_UP: 'user_signed_up',

  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_DROPPED_OFF: 'onboarding_dropped_off',

  // Feature usage
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  ARTICLE_VIEWED: 'article_viewed',
  ARTICLE_READ: 'article_read',
  QUIZ_STARTED: 'quiz_started',
  QUIZ_COMPLETED: 'quiz_completed',
  GARAGE_BIKE_ADDED: 'garage_bike_added',
  GARAGE_BIKE_REMOVED: 'garage_bike_removed',
  MAINTENANCE_TASK_CREATED: 'maintenance_task_created',
  MAINTENANCE_TASK_COMPLETED: 'maintenance_task_completed',
  MAINTENANCE_TASK_DELETED: 'maintenance_task_deleted',
  EXPENSE_ADDED: 'expense_added',

  // Rides
  RIDE_STARTED: 'ride_started',
  RIDE_COMPLETED: 'ride_completed',
  RIDE_SHARED: 'ride_shared',
  RIDE_VIEWED: 'ride_viewed',
  RIDE_DELETED: 'ride_deleted',

  // Routes (discovery)
  ROUTE_VIEWED: 'route_viewed',
  ROUTE_SAVED: 'route_saved',
  ROUTE_UNSAVED: 'route_unsaved',
  ROUTE_SHARED: 'route_shared',
  ROUTE_GPX_EXPORTED: 'route_gpx_exported',

  // Discovery
  DISCOVER_TAB_VIEWED: 'discover_tab_viewed',

  // Community
  GROUP_RIDE_CREATED: 'group_ride_created',
  GROUP_RIDE_JOINED: 'group_ride_joined',
  GROUP_RIDE_LEFT: 'group_ride_left',
  TRIP_CREATED: 'trip_created',
  TRIP_PUBLISHED: 'trip_published',
  TRIP_JOINED: 'trip_joined',
  TRIP_LEFT: 'trip_left',
  TRIP_DRAFT_SAVED: 'trip_draft_saved',
  TRIP_WAYPOINT_ADDED: 'trip_waypoint_added',
  TRIP_VIEWED: 'trip_viewed',
  TRIP_SHARED: 'trip_shared',
  TRIP_OPENED_IN_MAPS: 'trip_opened_in_maps',

  // Subscription funnel
  PAYWALL_VIEWED: 'paywall_viewed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_CANCELLED: 'purchase_cancelled',
  SUBSCRIPTION_RESTORED: 'subscription_restored',

  // Privacy
  DATA_EXPORT_REQUESTED: 'data_export_requested',

  // What's New
  WHATS_NEW_VIEWED: 'whats_new_viewed',
  WHATS_NEW_DISMISSED: 'whats_new_dismissed',

  // Navigation
  SCREEN_VIEWED: 'screen_viewed',
  TAB_CHANGED: 'tab_changed',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export function trackEvent(event: AnalyticsEventName, properties?: Record<string, JsonType>) {
  if (!analyticsEnabled) return;

  if (posthogClient) {
    posthogClient.capture(event, properties);
  }
}

export function trackScreen(screenName: string, properties?: Record<string, JsonType>) {
  if (!analyticsEnabled) return;

  if (posthogClient) {
    posthogClient.screen(screenName, properties);
  }
}

// ---- Sentry Error Helpers -------------------------------------------

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!crashReportingEnabled) return;

  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

export function addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>) {
  if (!crashReportingEnabled) return;

  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({ message, category, data });
  }
}

// ---- Flush ----------------------------------------------------------

export async function flushAnalytics() {
  if (posthogClient) {
    await posthogClient.flush();
  }
  if (SENTRY_DSN) {
    await Sentry.flush();
  }
}
