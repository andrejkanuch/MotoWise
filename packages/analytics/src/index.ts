// Event definitions

// Analytics client
export { identify, reset, setUserProperties, track } from './client';
// Event names and schemas (#365 T04a adds MOBILE_AUTH_EVENTS and the Auth* schemas)
export {
  ANALYTICS_EVENTS,
  AuthEmailSubmittedSchema,
  AuthErrorAlertShownSchema,
  AuthOAuthResultSchema,
  AuthOAuthStartedSchema,
  AuthPostSigninWaitSchema,
  EVENT_SCHEMAS,
  ExplorePageViewedSchema,
  FilterAppliedSchema,
  GpxDownloadAttemptedSchema,
  GpxDownloadAttemptedSchema as GPXDownloadAttemptedSchema,
  MOBILE_AUTH_EVENT_SCHEMAS,
  MOBILE_AUTH_EVENTS,
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
