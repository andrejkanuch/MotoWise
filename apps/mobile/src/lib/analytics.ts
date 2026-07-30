import type { JsonType } from '@posthog/core';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { Settings } from 'react-native-fbsdk-next';
import { getStoredAnalyticsConsent, setStoredAnalyticsConsent } from './analytics-consent';
import { getStoredUtmProperties } from './meta-attribution';
import { isNetworkError } from './network-error';

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
  // `captureAppLifecycleEvents` is intentionally left at its SDK default (`true`):
  // `Application Installed`/`Opened`/`Backgrounded` already flow to PostHog and are
  // relied on as the install-count denominator. Do NOT set it to false. (Note: the
  // install *source* is stamped separately as a $set_once person property in
  // meta-attribution.ts — the lifecycle event itself carries no channel.)
  // No PostHog data is sent in development — only release builds report to
  // PostHog. `__DEV__` is true under Metro/dev-client and false in EAS
  // preview/production builds, mirroring the Sentry `enabled: !__DEV__` gate
  // above. `disabled: true` makes all capture/screen/replay calls safe no-ops.
  disabled: __DEV__ || !POSTHOG_API_KEY,
  // Session replay only in release builds (redundant with `disabled` in dev,
  // but explicit). The recorder is CONSENT-GATED: the SDK auto-starts replay on
  // init based only on `enableSessionReplay` + remote config — it does NOT check
  // the user's opt-out — so we immediately `stopSessionRecording()` after init
  // unless last-known consent is true, and `setAnalyticsEnabled` is the single
  // source of truth that starts/stops the recorder thereafter (see todo 184).
  //
  // Masking is best-effort, NOT a guarantee that no PII is captured:
  //  - `maskAllTextInputs` masks `TextInput` only — read-only `<Text>` (VIN,
  //    email, paywall copy) is captured unless wrapped in `<PostHogMaskView>`.
  //  - `maskAllImages` masks RN `<Image>` only — native/GPU map surfaces
  //    (mapbox GPS tracks) are NOT covered; those screens are wrapped in
  //    `<PostHogMaskView>` (see todo 186).
  //  - `captureLog` is OFF: `console.*` is a text side-channel masking can't
  //    touch and the app logs coordinates/auth/purchase context (see todo 185).
  enableSessionReplay: !__DEV__,
  sessionReplayConfig: {
    maskAllTextInputs: true,
    maskAllImages: true,
    maskAllSandboxedViews: true,
    captureLog: false,
  },
});

// Default replay OFF until consent is confirmed. The SDK auto-starts the
// recorder at construction (gated only by `enableSessionReplay`/remote config,
// NOT by opt-out), so without this a pre-consent user — including the
// cold-start/login/onboarding window before the server `me` query resolves —
// would be recorded. We stop immediately unless the last-known consent
// (persisted locally) is true, then `setAnalyticsEnabled` takes over.
if (!__DEV__ && POSTHOG_API_KEY) {
  const consented = getStoredAnalyticsConsent();
  if (!consented) {
    // Fire-and-forget: stop any recording the SDK may have auto-started.
    void posthogClient.stopSessionRecording();
  }
}

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
  // Transient connectivity failures — the device was offline/backgrounded
  // when a request fired. Expected on spotty cellular; the offline sync queue
  // (ride-sync-queue.ts) already retries these. Not actionable as crashes.
  // Delegates to the shared detector so the needle list lives in one place.
  // (Sentry MOTO-VAULT-REACT-NATIVE-5 / -22 / -23 / -26 / -1Y)
  if (isNetworkError(message)) {
    return null;
  }
  // RevenueCat logOut() invoked for an already-anonymous user. logoutRevenueCat()
  // runs on every sign-out and guards with isAnonymous(), but the SDK can still
  // race and throw this benign error (iOS: "LogOut was called…", Android:
  // "Called logOut…"). No user impact — drop the noise.
  // (Sentry MOTO-VAULT-REACT-NATIVE-4 / -6)
  if (message.includes('current user is anonymous')) {
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
}

/**
 * Wraps the app's root component with Sentry's error/performance instrumentation.
 * Required by the SDK as its primary integration entry point — apply to the
 * default export of the root layout.
 */
export const withSentry: typeof Sentry.wrap = Sentry.wrap;

export function initPostHog() {
  // Client is initialized eagerly at module load time; this is a no-op kept for backwards compatibility.
}

// ---- Privacy Controls -----------------------------------------------

export function setAnalyticsEnabled(enabled: boolean) {
  analyticsEnabled = enabled;
  // Persist consent so the recorder can be gated synchronously on the next
  // cold start, before the server `me` query resolves (closes the pre-consent
  // recording window — todo 184).
  setStoredAnalyticsConsent(enabled);
  if (enabled) {
    // Consent just granted — wire attribution that was suppressed pre-consent
    // (KTD-9). Lazy imports avoid a static analytics↔subscription cycle; consent
    // is already persisted above so the gates inside pass. configureRcAttribution
    // wires RevenueCat; captureMetaAttribution re-fires the PostHog install emit
    // same-session (its memo was released because the pre-consent run did not emit).
    void import('./subscription')
      .then((m) => m.configureRcAttribution())
      .catch((e) => captureException(e, { source: 'analytics.setAnalyticsEnabled.rcAttribution' }));
    void import('./meta-attribution')
      .then((m) => m.captureMetaAttribution())
      .catch((e) =>
        captureException(e, { source: 'analytics.setAnalyticsEnabled.metaAttribution' }),
      );
    // Replay the intent-cohort super property. resolvePendingIntent may have run
    // pre-consent — registerSuperProperties no-ops while analytics is off, and the
    // referrer is one-shot (marked checked), so without this the cohort tag is lost
    // for the whole funnel. Re-derive from the persisted pending intent. Lazy
    // imports avoid a static analytics↔store cycle.
    void Promise.all([import('./pending-intent'), import('../stores/onboarding.store')])
      .then(([intentMod, storeMod]) => {
        const intent = storeMod.useOnboardingStore.getState().pendingIntent;
        if (intent) registerSuperProperties({ intent_cohort: intentMod.getIntentCohort(intent) });
      })
      .catch((e) => captureException(e, { source: 'analytics.setAnalyticsEnabled.intentCohort' }));
  }
  if (posthogClient) {
    if (enabled) {
      posthogClient.optIn();
      // `optIn`/`optOut` only gate the JS event queue — they do NOT control the
      // native session-replay recorder. Drive it explicitly so consent is
      // actually enforced for replay (todo 184). No-op when replay is disabled
      // (dev / no API key) or not on iOS/Android.
      void posthogClient.startSessionRecording();
    } else {
      posthogClient.optOut();
      void posthogClient.stopSessionRecording();
    }
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
    // biome-ignore lint/suspicious/noExplicitAny: Sentry v7 types getClient() as unknown in some TS versions
    const client = Sentry.getClient() as any;
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

/**
 * Set first-touch person properties that must NOT be overwritten on later launches
 * (acquisition source, install source). Uses PostHog `$set_once` semantics — the
 * value is written only if the property is not already set on the person. Consent-
 * gated like all other capture paths.
 *
 * Per the posthog-react-native docs, `$set`/`$set_once` are honored when capturing
 * ANY event; `$set` here is the SDK's property-only event name (mirrors the sibling
 * `setUserProperties`), and the `$set_once` payload is applied set-once server-side.
 */
export function setUserPropertiesOnce(properties: Record<string, JsonType>) {
  if (!analyticsEnabled || !posthogClient) return;
  posthogClient.capture('$set', { $set_once: properties });
}

/**
 * The current PostHog distinct_id (anonymous before sign-in). Used to stamp
 * RevenueCat's `$posthogUserId` pre-auth so anonymous purchases join the same
 * PostHog person once the account is created. Undefined when analytics is off.
 */
/**
 * Register PostHog super properties — attached to every subsequent event on this
 * device (persisted across launches) until unregistered/reset. Consent-gated.
 * Used for durable cohort tags (e.g. `intent_cohort`) that should segment the
 * whole funnel, not just a single event.
 */
export function registerSuperProperties(properties: Record<string, JsonType>) {
  if (!analyticsEnabled || !posthogClient) return;
  posthogClient.register(properties);
}

export function getAnalyticsDistinctId(): string | undefined {
  if (!analyticsEnabled || !posthogClient) return undefined;
  return posthogClient.getDistinctId();
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
  // Activation Goal 7 — a receipt scan completed during onboarding (KTD-10 quota-exempt).
  ONBOARDING_SCAN_COMPLETED: 'receipt_scan_onboarding_completed',
  ONBOARDING_DROPPED_OFF: 'onboarding_dropped_off',
  ONBOARDING_RESUMED: 'onboarding_resumed',
  // Onboarding A/B (2026) funnel — see docs/onboarding-ab-event-schema.md
  BIKE_ADDED: 'bike_added',
  REVEAL_VIEWED: 'reveal_viewed',
  COMMITMENT_COMPLETED: 'commitment_completed',
  ACCOUNT_CREATED: 'account_created',
  // Attribution — self-reported acquisition channel ("How did you hear about us?")
  REFERRAL_SOURCE_SELECTED: 'referral_source_selected',
  REFERRAL_SOURCE_SKIPPED: 'referral_source_skipped',
  // Web→app intent — "which bike" resolved from the Android Play install referrer
  PENDING_INTENT_RESOLVED: 'pending_intent_resolved',

  // Feature usage — Diagnostics
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  DIAGNOSTIC_LIST_VIEWED: 'diagnostic_list_viewed',

  // Store review
  REVIEW_PROMPTED: 'review_prompted',

  // Feature usage — Learn
  ARTICLE_VIEWED: 'article_viewed',
  ARTICLE_READ: 'article_read',

  // Feature usage — Garage
  GARAGE_BIKE_ADDED: 'garage_bike_added',
  GARAGE_BIKE_REMOVED: 'garage_bike_removed',
  MAINTENANCE_TASK_CREATED: 'maintenance_task_created',
  MAINTENANCE_TASK_UPDATED: 'maintenance_task_updated',
  MAINTENANCE_TASK_COMPLETED: 'maintenance_task_completed',
  MAINTENANCE_TASK_DELETED: 'maintenance_task_deleted',
  EXPENSE_ADDED: 'expense_added',
  EXPENSE_QUICK_ADD_TAPPED: 'expense_quick_add_tapped',
  EXPENSE_DASHBOARD_VIEWED: 'expense_dashboard_viewed',
  EXPENSE_SERVICE_RECORD_OPENED: 'expense_service_record_opened',
  // Receipt scan (U6)
  RECEIPT_SCAN_STARTED: 'receipt_scan_started',
  RECEIPT_SCAN_COMPLETED: 'receipt_scan_completed',
  RECEIPT_SCAN_PARKED: 'receipt_scan_parked',
  RECEIPT_SCAN_MANUAL_FALLBACK: 'receipt_scan_manual_fallback',
  // Receipt scan telemetry (R8) — completes the funnel so the feature is
  // evaluable in PostHog: upload failures/retries, extraction failures, and the
  // resume/graveyard-recovery paths that measure re-engagement.
  RECEIPT_SCAN_UPLOAD_FAILED: 'receipt_scan_upload_failed',
  RECEIPT_SCAN_UPLOAD_RETRIED: 'receipt_scan_upload_retried',
  RECEIPT_SCAN_EXTRACTION_FAILED: 'receipt_scan_extraction_failed',
  RECEIPT_SCAN_RESUMED: 'receipt_scan_resumed',
  RECEIPT_SCAN_NUDGE_CONVERTED: 'receipt_scan_nudge_converted',
  // Receipt scan review card (U7c) — measure Goal 5 (≤2 corrections)
  RECEIPT_SCAN_FIELD_EDITED: 'receipt_scan_field_edited',
  RECEIPT_SCAN_TYPE_SWITCHED: 'receipt_scan_type_switched',
  // Receipt scan save/undo (U7d) — Goal 1 (<20s flow) + feature evaluation (R8)
  RECEIPT_SCAN_SAVE_COMPLETED: 'receipt_scan_save_completed',
  RECEIPT_SCAN_ODOMETER_ACCEPTED: 'receipt_scan_odometer_accepted',
  RECEIPT_SCAN_SAVE_UNDONE: 'receipt_scan_save_undone',
  HEALTH_REPORT_VIEWED: 'health_report_viewed',
  HEALTH_REPORT_GENERATED: 'health_report_generated',
  HEALTH_REPORT_DOWNLOADED: 'health_report_downloaded',
  HEALTH_REPORT_RETRIED: 'health_report_retried',
  RECALLS_CHECKED: 'recalls_checked',
  OEM_SCHEDULE_IMPORTED: 'oem_schedule_imported',

  // Feature usage — Garage / Document Vault
  DOCUMENT_ADDED: 'document_added',
  DOCUMENT_VIEWED: 'document_viewed',
  DOCUMENT_DELETED: 'document_deleted',
  DOCUMENT_CATEGORY_ADDED: 'document_category_added',
  DOCUMENT_CATEGORY_DELETED: 'document_category_deleted',
  DOCUMENTS_SECTION_VIEWED: 'documents_section_viewed',
  DOCUMENT_EXPIRY_ALERT_TAPPED: 'document_expiry_alert_tapped',

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
  RIDE_MAP_PICKER_OPENED: 'ride_map_picker_opened',
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

  // Notifications & reminders (lifecycle) — grant rate gates the retention bets
  NOTIFICATION_PERMISSION_REQUESTED: 'notification_permission_requested',
  NOTIFICATION_PERMISSION_RESULT: 'notification_permission_result',
  REMINDER_SCHEDULED: 'reminder_scheduled',
  REMINDER_OPENED: 'reminder_opened',

  // Privacy
  DATA_EXPORT_REQUESTED: 'data_export_requested',

  // What's New
  WHATS_NEW_VIEWED: 'whats_new_viewed',
  WHATS_NEW_DISMISSED: 'whats_new_dismissed',
  WHATS_NEW_SKIPPED: 'whats_new_skipped',
  WHATS_NEW_SLIDE_VIEWED: 'whats_new_slide_viewed',
  WHATS_NEW_CTA_TAPPED: 'whats_new_cta_tapped',

  // Profile & Settings
  PROFILE_EDITED: 'profile_edited',
  SETTINGS_CHANGED: 'settings_changed',
  HEATMAP_VIEWED: 'heatmap_viewed',
  RIDES_HISTORY_VIEWED: 'rides_history_viewed',

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
    // Tag alias captures so PostHog insights can exclude them (filter `_meta_alias`
    // is not set). They exist only to satisfy Meta Conversions API naming (MOT-212);
    // always analyze diagnostic/trip/maintenance activity on the ORIGINAL event name.
    if (alias) posthogClient.capture(alias, { ...properties, _meta_alias: true });
  }
}

// Surveys are now PostHog-managed (popover) via PostHogSurveyProvider in
// _layout.tsx — display timing, targeting, and capture (`survey shown/sent/
// dismissed`) are handled by the SDK. No app-side survey trigger logic.

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

/**
 * Records an intentional, non-crash signal (an expected edge case worth
 * observing) at a chosen severity — NOT the error stream. Use this instead of
 * `captureException(new Error(...))` for telemetry that should not show up as an
 * unresolved error/issue in Sentry.
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' = 'warning',
  context?: Record<string, unknown>,
) {
  if (!crashReportingEnabled) return;

  if (SENTRY_DSN) {
    Sentry.captureMessage(message, { level, extra: context });
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
