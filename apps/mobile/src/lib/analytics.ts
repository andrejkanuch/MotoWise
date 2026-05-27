import type { JsonType } from '@posthog/core';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { Settings } from 'react-native-fbsdk-next';
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

/** Exported for testing — filters non-actionable native crashes from Sentry. */
export function sentryBeforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  const message = event.exception?.values?.[0]?.value ?? event.exception?.values?.[0]?.type ?? '';
  // Known React Native Fabric race condition — view is unmounted before
  // an async image/reanimated callback can update props. Not actionable.
  if (message.includes('Unable to find viewState for tag')) {
    return null;
  }
  // Hermes VM internal native crash — memory corruption or GC bug
  // in the engine itself, not in application JS. Not actionable.
  // Only drop when EVERY frame is a Hermes/RN internal frame (no app JS).
  const frames = event.exception?.values?.flatMap((v) => v.stacktrace?.frames ?? []);
  if (
    frames &&
    frames.length > 0 &&
    frames.every(
      (f) =>
        !f.in_app || f.function?.startsWith('hermes::') || f.function?.startsWith('facebook::'),
    )
  ) {
    return null;
  }
  return event;
}

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    profilesSampleRate: __DEV__ ? 1.0 : 0.3,
    enabled: !__DEV__,
    enableAutoSessionTracking: true,
    attachScreenshot: true,
    debug: false,
    // Session Replay — capture all error sessions + 10% of normal sessions
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
    integrations: [
      sentryNavigationIntegration,
      // Mobile Session Replay — privacy-safe screen recording
      Sentry.mobileReplayIntegration({
        maskAllText: false,
        maskAllImages: false,
        maskAllVectors: false,
      }),
      // Hermes CPU profiling — attached to sampled transactions
      Sentry.hermesProfilingIntegration(),
      // UI thread stall detection (jank > 300ms)
      Sentry.stallTrackingIntegration({ minimumStallThresholdMs: 300 }),
      // Spotlight for local dev — view Sentry events without the dashboard
      ...(__DEV__ ? [Sentry.spotlightIntegration()] : []),
    ],
    beforeSend: sentryBeforeSend,
  });

  // Shake-to-report bug feedback (production only, Sentry v8+)
  // eslint-disable-next-line -- enableFeedbackOnShake exists in Sentry v8 but not v7 types
  if (!__DEV__ && 'enableFeedbackOnShake' in Sentry) {
    (Sentry as Record<string, unknown>).enableFeedbackOnShake();
  }
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
  try {
    Settings.setAdvertiserTrackingEnabled(enabled);
  } catch {
    // Can crash on iOS simulator
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
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_STEP_SKIPPED: 'onboarding_step_skipped',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_DROPPED_OFF: 'onboarding_dropped_off',

  // Feature usage — Diagnostics
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  DIAGNOSTIC_LIST_VIEWED: 'diagnostic_list_viewed',

  // Store review
  REVIEW_PROMPTED: 'review_prompted',

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
  HEALTH_REPORT_GENERATED: 'health_report_generated',
  HEALTH_REPORT_DOWNLOADED: 'health_report_downloaded',
  HEALTH_REPORT_RETRIED: 'health_report_retried',
  RECALLS_CHECKED: 'recalls_checked',
  OEM_SCHEDULE_IMPORTED: 'oem_schedule_imported',

  // Rides — lifecycle
  RIDE_STARTED: 'ride_started',
  RIDE_PAUSED: 'ride_paused',
  RIDE_RESUMED: 'ride_resumed',
  RIDE_ENDED: 'ride_ended',
  RIDE_COMPLETED: 'ride_completed',
  RIDE_ABANDONED: 'ride_abandoned',
  RIDE_SHARED: 'ride_shared',
  SHARE_SHEET_OPENED: 'share_sheet_opened',
  SHARE_CARD_SWIPED: 'share_card_swiped',
  SHARE_DESTINATION_TAPPED: 'share_destination_tapped',
  RIDE_VIEWED: 'ride_viewed',
  RIDE_DELETED: 'ride_deleted',
  RIDE_DISCARDED: 'ride_discarded',
  RIDE_TOO_SHORT_SHOWN: 'ride_too_short_shown',
  RIDE_AUTO_SAVED: 'ride_auto_saved',
  RIDE_GPS_READINESS: 'ride_gps_readiness',
  RIDE_ZERO_DISTANCE_SHOWN: 'ride_zero_distance_shown',
  // Rides — engagement
  RIDE_HUD_LAYOUT_SWITCHED: 'ride_hud_layout_switched',
  RIDE_NAME_EDITED: 'ride_name_edited',
  RIDE_CHART_VIEWED: 'ride_chart_viewed',
  RIDE_MAP_STYLE_CHANGED: 'ride_map_style_changed',
  RIDE_BIKE_CHANGED: 'ride_bike_changed',
  // Rides — history
  RIDES_HISTORY_FILTERED: 'rides_history_filtered',
  // Rides — Phase 0.5 analytics
  OVERVIEW_VIEWED: 'overview_viewed',
  RIDES_TAB_SCROLL_DEPTH: 'rides_tab_scroll_depth',
  RIDES_OVERVIEW_REFRESHED: 'rides_overview_refreshed',
  RECORD_BADGE_VIEWED: 'record_badge_viewed',
  RECORD_BADGE_TAPPED: 'record_badge_tapped',
  PB_TOAST_SEEN: 'pb_toast_seen',
  PB_TOAST_TAPPED: 'pb_toast_tapped',
  PB_TOAST_DISMISSED: 'pb_toast_dismissed',
  ELEVATION_CHART_VIEWED: 'elevation_chart_viewed',
  LEAN_ANGLE_TOOLTIP_OPENED: 'lean_angle_tooltip_opened',
  RIDE_FLYOVER_STARTED: 'ride_flyover_started',
  RIDE_FLYOVER_COMPLETED: 'ride_flyover_completed',
  RIDE_FLYOVER_EXITED: 'ride_flyover_exited',
  RIDE_FLYOVER_SPEED_CHANGED: 'ride_flyover_speed_changed',
  SHARE_CARD_GENERATED: 'share_card_generated',
  SHARE_CARD_FAILED: 'share_card_failed',
  SHARE_COMPLETED: 'share_completed',
  SHARE_RESULT: 'share_result',

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
  WHATS_NEW_SKIPPED: 'whats_new_skipped',
  WHATS_NEW_SLIDE_VIEWED: 'whats_new_slide_viewed',

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

  // Checklist
  CHECKLIST_ITEM_COMPLETED: 'checklist_item_completed',
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
