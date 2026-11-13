// Event definitions

// Analytics client
export { identify, reset, setUserProperties, track } from './client';
export {
  ANALYTICS_EVENTS,
  EVENT_SCHEMAS,
  ExplorePageViewedSchema,
  FilterAppliedSchema,
  GpxDownloadAttemptedSchema,
  GpxDownloadAttemptedSchema as GPXDownloadAttemptedSchema,
  LimitSheetViewedSchema,
  PAYWALL_GATE_EVENTS,
  PAYWALL_GATE_POLICY,
  PAYWALL_SUPPRESSED_REASON,
  PAYWALL_TRIGGER,
  PaywallSessionPropertiesSchema,
  PaywallSuppressedSchema,
  RegionPageViewedSchema,
  RouteSavedSchema,
  RouteSearchedSchema,
  RouteUnsavedSchema,
  RouteViewedSchema,
  SearchPerformedSchema,
  SignupStartedSchema,
} from './events';
// Inferred types
export type {
  AnalyticsEventMap,
  AnalyticsEventName,
  AnalyticsUserProperties,
  ExplorePageViewedProperties,
  FilterAppliedProperties,
  GpxDownloadAttemptedProperties,
  RegionPageViewedProperties,
  RouteSavedProperties,
  RouteSearchedProperties,
  RouteUnsavedProperties,
  RouteViewedProperties,
  SearchPerformedProperties,
  SignupStartedProperties,
} from './types';
