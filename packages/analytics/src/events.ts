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
