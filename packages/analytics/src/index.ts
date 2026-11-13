// Event definitions

// Analytics client
export { identify, reset, setUserProperties, track } from './client';
export {
  ANALYTICS_EVENTS,
  AuthSessionLostSchema,
  EVENT_SCHEMAS,
  ExplorePageViewedSchema,
  FilterAppliedSchema,
  GateRoutedSchema,
  GpxDownloadAttemptedSchema,
  GpxDownloadAttemptedSchema as GPXDownloadAttemptedSchema,
  MOBILE_ONBOARDING_NAV_EVENTS,
  OnboardingBackSchema,
  OnboardingResumedSchema,
  OnboardingWelcomeMountedSchema,
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
