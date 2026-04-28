import type { JsonType } from '@posthog/core';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { getStoredUtmProperties } from './meta-attribution';

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

export async function identifyUser(
  userId: string,
  properties?: {
    experience_level?: string;
    bike_count?: number;
    is_pro?: boolean;
    currency?: string;
    locale?: string;
    app_version?: string;
  },
) {
  if (analyticsEnabled && posthogClient) {
    // Carry forward UTM attribution properties from SecureStore (MOT-211)
    const utmProps = await getStoredUtmProperties();
    posthogClient.identify(userId, { ...properties, ...utmProps });
  }
  if (crashReportingEnabled && SENTRY_DSN) {
    Sentry.setUser({ id: userId });
  }
}

/** Update user properties on the already-identified user (e.g. after purchase, bike add). */
export function setUserProperties(properties: Record<string, JsonType>) {
  if (!analyticsEnabled || !posthogClient) return;
  posthogClient.capture('$set', { $set: properties });
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
  ONBOARDING_STEP_SKIPPED: 'onboarding_step_skipped',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_DROPPED_OFF: 'onboarding_dropped_off',

  // Feature usage — Diagnostics
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  DIAGNOSTIC_LIST_VIEWED: 'diagnostic_list_viewed',

  // Feature usage — Learn
  ARTICLE_VIEWED: 'article_viewed',
  ARTICLE_READ: 'article_read',
  QUIZ_STARTED: 'quiz_started',
  QUIZ_COMPLETED: 'quiz_completed',

  // Feature usage — Garage
  GARAGE_BIKE_ADDED: 'garage_bike_added',
  GARAGE_BIKE_REMOVED: 'garage_bike_removed',
  MAINTENANCE_TASK_CREATED: 'maintenance_task_created',
  MAINTENANCE_TASK_COMPLETED: 'maintenance_task_completed',
  MAINTENANCE_TASK_DELETED: 'maintenance_task_deleted',
  EXPENSE_ADDED: 'expense_added',
  EXPENSE_DELETED: 'expense_deleted',
  EXPENSE_DASHBOARD_VIEWED: 'expense_dashboard_viewed',
  FUEL_LOG_ADDED: 'fuel_log_added',
  HEALTH_REPORT_VIEWED: 'health_report_viewed',

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
  DISCOVER_FILTER_APPLIED: 'discover_filter_applied',
  DISCOVER_SEARCH_USED: 'discover_search_used',

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
  TRIP_BRIEF_SHARED: 'trip_brief_shared',
  TRIP_OFFLINE_DOWNLOADED: 'trip_offline_downloaded',
  TRIP_OFFLINE_REMOVED: 'trip_offline_removed',

  // Nav-app handoff (superset — emitted alongside legacy TRIP_OPENED_IN_MAPS
  // / ROUTE_GPX_EXPORTED for PostHog funnel continuity).
  NAV_HANDOFF: 'nav_handoff',

  // Subscription funnel
  PAYWALL_PRESENT_REQUESTED: 'paywall_present_requested',
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  PAYWALL_RESULT: 'paywall_result',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_CANCELLED: 'purchase_cancelled',
  SUBSCRIPTION_RESTORED: 'subscription_restored',

  // Privacy
  DATA_EXPORT_REQUESTED: 'data_export_requested',

  // What's New
  WHATS_NEW_VIEWED: 'whats_new_viewed',
  WHATS_NEW_DISMISSED: 'whats_new_dismissed',

  // Profile & Settings
  PROFILE_EDITED: 'profile_edited',
  SETTINGS_CHANGED: 'settings_changed',
  HEATMAP_VIEWED: 'heatmap_viewed',
  RIDES_HISTORY_VIEWED: 'rides_history_viewed',
  USER_FOLLOWED: 'user_followed',
  USER_UNFOLLOWED: 'user_unfollowed',

  // Navigation
  SCREEN_VIEWED: 'screen_viewed',
  TAB_CHANGED: 'tab_changed',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

// Meta scoring aliases — maps existing events to Meta-required names (MOT-212).
// Fired automatically inside trackEvent so components don't need duplicate calls.
const META_ALIASES: Partial<Record<AnalyticsEventName, string>> = {
  diagnostic_started: 'ai_diagnosis_started',
  diagnostic_completed: 'ai_diagnosis_completed',
  maintenance_task_created: 'maintenance_log_added',
  trip_viewed: 'trip_plan_viewed',
};

export function trackEvent(event: AnalyticsEventName, properties?: Record<string, JsonType>) {
  if (!analyticsEnabled) return;

  if (posthogClient) {
    posthogClient.capture(event, properties);
    const alias = META_ALIASES[event];
    if (alias) posthogClient.capture(alias, properties);
  }
}

// ---- Survey Trigger (CSAT) -------------------------------------------

// Lazy import to avoid circular dependency (survey.store imports analytics)
let _surveyStore: typeof import('../stores/survey.store') | null = null;
function getSurveyStore() {
  if (!_surveyStore) _surveyStore = require('../stores/survey.store');
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by the line above
  return _surveyStore!;
}

type SurveyTriggerAction = import('../stores/survey.store').SurveyTriggerAction;

const SURVEY_TRIGGER_MAP: Partial<Record<AnalyticsEventName, SurveyTriggerAction>> = {
  expense_added: 'expense_added',
  maintenance_task_created: 'maintenance_task_created',
  trip_created: 'trip_created',
  diagnostic_completed: 'diagnostic_completed',
};

/**
 * Track an event and maybe trigger the CSAT survey.
 * Drop-in replacement for trackEvent() at qualifying action sites.
 */
export function trackEventWithSurvey(
  event: AnalyticsEventName,
  properties?: Record<string, JsonType>,
) {
  trackEvent(event, properties);
  const actionType = SURVEY_TRIGGER_MAP[event];
  if (actionType) {
    getSurveyStore().useSurveyStore.getState().tryShow(actionType);
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
