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

// #365 T04b — mobile onboarding navigation, resume and gate events. Sent by
// apps/mobile (`AnalyticsEvent` in src/lib/analytics.ts; helpers in
// src/lib/onboarding-nav-analytics.ts), not by this web client. Names and
// property shapes are listed here as the shared catalog; schema doc:
// docs/onboarding-ab-event-schema.md, "#365 T04b".
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
