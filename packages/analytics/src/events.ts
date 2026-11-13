import { z } from 'zod';

/**
 * Canonical event names — single source of truth.
 * Use these constants instead of raw strings when calling `track()`.
 */
export const ANALYTICS_EVENTS = {
  ROUTE_VIEWED: 'route_viewed',
  ROUTE_SEARCHED: 'route_searched',
  ROUTE_SAVED: 'route_saved',
  ROUTE_UNSAVED: 'route_unsaved',
  FILTER_APPLIED: 'filter_applied',
  GPX_DOWNLOAD_ATTEMPTED: 'gpx_download_attempted',
  SIGNUP_STARTED: 'signup_started',
  SEARCH_PERFORMED: 'search_performed',
  EXPLORE_PAGE_VIEWED: 'explore_page_viewed',
  REGION_PAGE_VIEWED: 'region_page_viewed',
  // issue 365 T04c
  BIKE_SETUP_SUMMARY: 'bike_setup_summary',
} as const;

// Issue 365 T04b — mobile onboarding navigation, resume and gate events. Sent by
// apps/mobile (`AnalyticsEvent` in src/lib/analytics.ts; helpers in
// src/lib/onboarding-nav-analytics.ts), not by this web client. Names and
// property shapes are listed here as the shared catalog; schema doc:
// docs/onboarding-ab-event-schema.md, "issue 365 T04b".
export const MOBILE_ONBOARDING_NAV_EVENTS = {
  ONBOARDING_BACK: 'onboarding_back',
  ONBOARDING_WELCOME_MOUNTED: 'onboarding_welcome_mounted',
  ONBOARDING_RESUMED: 'onboarding_resumed',
  GATE_ROUTED: 'gate_routed',
  AUTH_SESSION_LOST: 'auth_session_lost',
} as const;

export const OnboardingBackSchema = z.object({
  from: z.string().nullable(),
  /** A step name, or 'exit' when Android Back leaves the app from the stack root. */
  to: z.string().nullable(),
  trigger: z.enum(['hardware', 'gesture', 'button']),
  ms_on_screen: z.number().int().nonnegative().nullable(),
});

export const OnboardingWelcomeMountedSchema = z.object({
  reason: z.enum(['initial', 'back', 'remount']),
  had_progress: z.boolean(),
});

/** The T04b additions; `last_completed` and `resume_target` predate them. */
export const OnboardingResumedSchema = z.object({
  last_completed: z.string(),
  resume_target: z.string(),
  resumed_from_screen: z.string().nullable(),
  away_s: z.number().int().nonnegative().nullable(),
  cold_start: z.boolean(),
  pending_code_step: z.union([z.literal(0), z.literal(1)]),
  had_session: z.union([z.literal(0), z.literal(1)]),
});

export const GateRoutedSchema = z.object({
  group: z.enum(['restoring', 'auth', 'onboarding', 'tabs', 'none']),
  onboarding_completed_source: z.enum(['local', 'me_cache', 'me_network', 'none']),
  me_age_s: z.number().int().nullable(),
});

export const AuthSessionLostSchema = z.object({
  during_onboarding: z.boolean(),
  last_step: z.string().nullable(),
  auth_event: z.string(),
});

// ---------------------------------------------------------------------------
// Event property schemas
// ---------------------------------------------------------------------------

export const RouteViewedSchema = z.object({
  routeId: z.string(),
  routeName: z.string().optional(),
  region: z.string().optional(),
  source: z.enum(['explore', 'search', 'saved', 'direct']).optional(),
});

export const RouteSearchedSchema = z.object({
  query: z.string(),
  resultCount: z.number().int().nonnegative(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const RouteSavedSchema = z.object({
  routeId: z.string(),
  routeName: z.string().optional(),
});

export const RouteUnsavedSchema = z.object({
  routeId: z.string(),
});

export const FilterAppliedSchema = z.object({
  filterType: z.string(),
  filterValue: z.unknown(),
  context: z.enum(['routes', 'explore', 'search']).optional(),
});

export const GpxDownloadAttemptedSchema = z.object({
  routeId: z.string(),
  routeName: z.string().optional(),
  authenticated: z.boolean(),
});

export const SignupStartedSchema = z.object({
  source: z.string().optional(),
  trigger: z.string().optional(),
});

export const SearchPerformedSchema = z.object({
  query: z.string(),
  category: z.string().optional(),
  resultCount: z.number().int().nonnegative().optional(),
});

export const ExplorePageViewedSchema = z.object({
  region: z.string().optional(),
  routeCount: z.number().int().nonnegative().optional(),
});

export const RegionPageViewedSchema = z.object({
  region: z.string(),
  routeCount: z.number().int().nonnegative().optional(),
});

// Issue 365 T05a — mobile paywall contract (fired by apps/mobile `lib/subscription.ts`;
// the two events below by the T21 session cap). Kept out of ANALYTICS_EVENTS,
// which types the web `track()` client.
export const PAYWALL_GATE_EVENTS = {
  PAYWALL_SUPPRESSED: 'paywall_suppressed',
  LIMIT_SHEET_VIEWED: 'limit_sheet_viewed',
} as const;

export const PAYWALL_TRIGGER = { AUTO: 'auto', RIDER_TAP: 'rider_tap' } as const;
export const PAYWALL_GATE_POLICY = { NONE: 'none', CAPPED_V1: 'capped_v1' } as const;
export const PAYWALL_SUPPRESSED_REASON = {
  FEATURE_CAP: 'feature_cap',
  SESSION_CAP: 'session_cap',
  ERROR_COOLDOWN: 'error_cooldown',
} as const;

/** Added to `paywall_present_requested`, `paywall_viewed` and `paywall_result`. */
export const PaywallSessionPropertiesSchema = z.object({
  trigger: z.enum([PAYWALL_TRIGGER.AUTO, PAYWALL_TRIGGER.RIDER_TAP]),
  gate_policy: z.enum([PAYWALL_GATE_POLICY.NONE, PAYWALL_GATE_POLICY.CAPPED_V1]),
  session_paywall_index: z.number().int().positive(),
  minutes_since_onboarding_completed: z.number().int().nonnegative().nullable(),
});

export const PaywallSuppressedSchema = z.object({
  feature: z.string(),
  surface: z.string(),
  reason: z.enum([
    PAYWALL_SUPPRESSED_REASON.FEATURE_CAP,
    PAYWALL_SUPPRESSED_REASON.SESSION_CAP,
    PAYWALL_SUPPRESSED_REASON.ERROR_COOLDOWN,
  ]),
});

export const LimitSheetViewedSchema = z.object({
  feature: z.string(),
  surface: z.string(),
});

// issue 365 T04c — mobile onboarding bike-setup visit summary. Counts and enums only.
const BikePickedViaSchema = z.enum([
  'list',
  'search',
  'custom',
  'chip',
  'intent',
  'restored',
  'none',
]);

export const BikeSetupSummarySchema = z.object({
  outcome: z.enum(['completed', 'skipped', 'back', 'left']),
  duration_ms: z.number().int().nonnegative(),
  make_queries: z.number().int().nonnegative(),
  model_queries: z.number().int().nonnegative(),
  make_picked_via: BikePickedViaSchema,
  model_picked_via: BikePickedViaSchema,
  model_list_size: z.number().int().nonnegative(),
  model_fetch_ms: z.number().int().nonnegative().nullable(),
  year_changed: z.boolean(),
});

/**
 * Maps each event name to its Zod schema for runtime validation.
 */
export const EVENT_SCHEMAS = {
  [ANALYTICS_EVENTS.ROUTE_VIEWED]: RouteViewedSchema,
  [ANALYTICS_EVENTS.ROUTE_SEARCHED]: RouteSearchedSchema,
  [ANALYTICS_EVENTS.ROUTE_SAVED]: RouteSavedSchema,
  [ANALYTICS_EVENTS.ROUTE_UNSAVED]: RouteUnsavedSchema,
  [ANALYTICS_EVENTS.FILTER_APPLIED]: FilterAppliedSchema,
  [ANALYTICS_EVENTS.GPX_DOWNLOAD_ATTEMPTED]: GpxDownloadAttemptedSchema,
  [ANALYTICS_EVENTS.SIGNUP_STARTED]: SignupStartedSchema,
  [ANALYTICS_EVENTS.SEARCH_PERFORMED]: SearchPerformedSchema,
  [ANALYTICS_EVENTS.EXPLORE_PAGE_VIEWED]: ExplorePageViewedSchema,
  [ANALYTICS_EVENTS.REGION_PAGE_VIEWED]: RegionPageViewedSchema,
  // issue 365 T04c
  [ANALYTICS_EVENTS.BIKE_SETUP_SUMMARY]: BikeSetupSummarySchema,
} as const;

// #365 T04a — mobile auth events. The app captures them through its own
// `AnalyticsEvent` (apps/mobile/src/lib/analytics.ts); the names and property shapes
// live here too so dashboards and any other client share one spelling. They are not
// part of the web `track()` map above. No email and no free-text message, ever:
// `error_code` is the error's code (or class name) only.
export const MOBILE_AUTH_EVENTS = {
  AUTH_OAUTH_STARTED: 'auth_oauth_started',
  AUTH_OAUTH_RESULT: 'auth_oauth_result',
  AUTH_ERROR_ALERT_SHOWN: 'auth_error_alert_shown',
  AUTH_EMAIL_SUBMITTED: 'auth_email_submitted',
  AUTH_POST_SIGNIN_WAIT: 'auth_post_signin_wait',
} as const;

const AuthProviderSchema = z.enum(['apple', 'google']);
const AuthSurfaceSchema = z.enum(['onboarding_account', 'onboarding_sign_in', 'login', 'register']);
const OAuthOutcomeSchema = z.enum([
  'success',
  'cancelled',
  'in_progress',
  'no_play_services',
  'cannot_present',
  'error',
]);
const AuthErrorCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9_.-]{1,64}$/)
  .nullable();

export const AuthOAuthStartedSchema = z.object({
  provider: AuthProviderSchema,
  surface: AuthSurfaceSchema,
});

export const AuthOAuthResultSchema = z.object({
  provider: AuthProviderSchema,
  surface: AuthSurfaceSchema,
  outcome: OAuthOutcomeSchema,
  stage: z.enum(['sheet', 'token_exchange']),
  duration_ms: z.number().int().nonnegative(),
  is_new_user: z.boolean().nullable(),
  error_code: AuthErrorCodeSchema,
});

export const AuthErrorAlertShownSchema = z.object({
  provider: AuthProviderSchema,
  outcome: OAuthOutcomeSchema.exclude(['success', 'in_progress']),
  error_code: AuthErrorCodeSchema,
});

export const AuthEmailSubmittedSchema = z.object({
  surface: AuthSurfaceSchema,
  mode: z.enum(['signup', 'signin']),
});

export const AuthPostSigninWaitSchema = z.object({
  wait_ms: z.number().int().nonnegative(),
  outcome: z.enum(['advanced', 'already_onboarded', 'me_error', 'timeout']),
});

export const MOBILE_AUTH_EVENT_SCHEMAS = {
  [MOBILE_AUTH_EVENTS.AUTH_OAUTH_STARTED]: AuthOAuthStartedSchema,
  [MOBILE_AUTH_EVENTS.AUTH_OAUTH_RESULT]: AuthOAuthResultSchema,
  [MOBILE_AUTH_EVENTS.AUTH_ERROR_ALERT_SHOWN]: AuthErrorAlertShownSchema,
  [MOBILE_AUTH_EVENTS.AUTH_EMAIL_SUBMITTED]: AuthEmailSubmittedSchema,
  [MOBILE_AUTH_EVENTS.AUTH_POST_SIGNIN_WAIT]: AuthPostSigninWaitSchema,
} as const;
