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
} as const;

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
