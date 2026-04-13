import type { z } from 'zod';
import type {
  ANALYTICS_EVENTS,
  ExplorePageViewedSchema,
  FilterAppliedSchema,
  GpxDownloadAttemptedSchema,
  RegionPageViewedSchema,
  RouteSavedSchema,
  RouteSearchedSchema,
  RouteUnsavedSchema,
  RouteViewedSchema,
  SearchPerformedSchema,
  SignupStartedSchema,
} from './events';

// ---------------------------------------------------------------------------
// Inferred types from Zod schemas
// ---------------------------------------------------------------------------

export type RouteViewedProperties = z.infer<typeof RouteViewedSchema>;
export type RouteSearchedProperties = z.infer<typeof RouteSearchedSchema>;
export type RouteSavedProperties = z.infer<typeof RouteSavedSchema>;
export type RouteUnsavedProperties = z.infer<typeof RouteUnsavedSchema>;
export type FilterAppliedProperties = z.infer<typeof FilterAppliedSchema>;
export type GpxDownloadAttemptedProperties = z.infer<typeof GpxDownloadAttemptedSchema>;
export type SignupStartedProperties = z.infer<typeof SignupStartedSchema>;
export type SearchPerformedProperties = z.infer<typeof SearchPerformedSchema>;
export type ExplorePageViewedProperties = z.infer<typeof ExplorePageViewedSchema>;
export type RegionPageViewedProperties = z.infer<typeof RegionPageViewedSchema>;

// ---------------------------------------------------------------------------
// Event name union type
// ---------------------------------------------------------------------------

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ---------------------------------------------------------------------------
// Type-safe event map: event name -> properties
// ---------------------------------------------------------------------------

export type AnalyticsEventMap = {
  route_viewed: RouteViewedProperties;
  route_searched: RouteSearchedProperties;
  route_saved: RouteSavedProperties;
  route_unsaved: RouteUnsavedProperties;
  filter_applied: FilterAppliedProperties;
  gpx_download_attempted: GpxDownloadAttemptedProperties;
  signup_started: SignupStartedProperties;
  search_performed: SearchPerformedProperties;
  explore_page_viewed: ExplorePageViewedProperties;
  region_page_viewed: RegionPageViewedProperties;
};

// ---------------------------------------------------------------------------
// User properties for identify()
// ---------------------------------------------------------------------------

export type AnalyticsUserProperties = {
  bikeCount?: number;
  plan?: string;
  region?: string;
  signupSource?: string;
};
