import posthog from 'posthog-js';

// -------------------------------------------------------------------
// Web Analytics Wrapper (PostHog)
// -------------------------------------------------------------------
// Central typed event tracking for the MotoVault web app. PostHog is
// initialized in instrumentation-client.ts with opt_out_capturing_by_default.
// Events are no-ops until the user grants consent via the cookie banner.
//
// Legacy gtag events (app_store_click, waitlist_signup, blog_read) are
// now routed through PostHog so all analytics live in one place.
// -------------------------------------------------------------------

export const WebEvent = {
  // Auth
  SIGN_IN_SUBMITTED: 'sign_in_submitted',
  SIGN_IN_ERROR: 'sign_in_error',
  SIGN_IN_OAUTH_CLICKED: 'sign_in_oauth_clicked',
  SIGN_UP_SUBMITTED: 'sign_up_submitted',
  SIGN_UP_ERROR: 'sign_up_error',
  SIGN_UP_OAUTH_CLICKED: 'sign_up_oauth_clicked',
  SIGN_UP_COMPLETED: 'sign_up_completed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',

  // Marketing / Conversion
  HERO_CTA_CLICKED: 'hero_cta_clicked',
  APP_STORE_CLICK: 'app_store_click',
  WAITLIST_SIGNUP: 'waitlist_signup',
  FEATURE_PAGE_VIEWED: 'feature_page_viewed',
  COMPARE_PAGE_VIEWED: 'compare_page_viewed',

  // Pricing / Checkout
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  CHECKOUT_INITIATED: 'checkout_initiated',
  CHECKOUT_COMPLETED: 'checkout_completed',
  CHECKOUT_CANCELLED: 'checkout_cancelled',

  // Blog
  BLOG_LIST_VIEWED: 'blog_list_viewed',
  BLOG_ARTICLE_READ: 'blog_article_read',

  // Explore / Content
  EXPLORE_PAGE_VIEWED: 'explore_page_viewed',
  EXPLORE_COUNTRY_VIEWED: 'explore_country_viewed',
  EXPLORE_REGION_VIEWED: 'explore_region_viewed',
  TRIP_DETAIL_VIEWED: 'trip_detail_viewed',
  ROUTE_DETAIL_VIEWED: 'route_detail_viewed',
  RIDE_SHARED_VIEWED: 'ride_shared_viewed',
  BIKE_PAGE_VIEWED: 'bike_page_viewed',

  // Content Interaction
  OPEN_IN_APP_CLICKED: 'open_in_app_clicked',
  GPX_DOWNLOAD_CLICKED: 'gpx_download_clicked',
  ROUTE_SAVED_WEB: 'route_saved_web',
  SHARE_BUTTON_CLICKED: 'share_button_clicked',

  // Community
  FEED_VIEWED: 'feed_viewed',
  KUDOS_TOGGLED: 'kudos_toggled',
  PROFILE_VIEWED: 'profile_viewed',
  PROFILE_EDITED: 'profile_edited',
  PUBLIC_PROFILE_VIEWED: 'public_profile_viewed',
  GARAGE_VIEWED: 'garage_viewed',

  // Tools
  TOOL_USED: 'tool_used',

  // Consent
  CONSENT_GRANTED: '$consent_granted',

  // Review soft-wall
  REVIEW_SOFTWALL_SHOWN: 'review_softwall.shown',
  REVIEW_SOFTWALL_CTA_CLICKED: 'review_softwall.cta_clicked',

  // Trip engagement (web-side)
  TRIP_ROUTE_PREVIEWED: 'trip_route_previewed',
  TRIP_ITINERARY_EXPANDED: 'trip_itinerary_expanded',
  TRIP_WAYPOINT_CLICKED: 'trip_waypoint_clicked',
  TRIP_DIFFICULTY_FILTER_USED: 'trip_difficulty_filter_used',
  TRIP_DURATION_FILTER_USED: 'trip_duration_filter_used',
  TRIP_COUNTRY_FILTER_USED: 'trip_country_filter_used',

  // SEO / Content discovery
  SEARCH_PERFORMED: 'search_performed',
  SCROLL_DEPTH_50: 'scroll_depth_50',
  SCROLL_DEPTH_100: 'scroll_depth_100',
  TIME_ON_PAGE_30S: 'time_on_page_30s',
  TIME_ON_PAGE_60S: 'time_on_page_60s',

  // Engagement quality signals
  SECOND_PAGE_VIEWED: 'second_page_viewed',
  SESSION_PAGES_3_PLUS: 'session_pages_3_plus',
  RETURN_VISITOR: 'return_visitor',

  // Error / friction tracking
  PAGE_NOT_FOUND: 'page_not_found',
  API_ERROR_SHOWN: 'api_error_shown',
  SLOW_PAGE_LOAD: 'slow_page_load',

  // Explore monetization
  FILTER_APPLIED: 'filter_applied',
  SORT_CHANGED: 'sort_changed',
  MAP_VIEW_TOGGLED: 'map_view_toggled',

  // Saves
  TRIP_SAVED_ANONYMOUS: 'trip_saved_anonymous',
  EMAIL_CAPTURE_MODAL_SHOWN: 'email_capture_modal_shown',
  EMAIL_CAPTURED_POST_SAVE: 'email_captured_post_save',

  // GPX
  GPX_DOWNLOAD_ATTEMPTED: 'gpx_download_attempted',
  GPX_DOWNLOAD_DENIED: 'gpx_download_denied',
  GPX_PREVIEW_SHOWN: 'gpx_preview_shown',

  // Pro
  PRO_CTA_CLICKED: 'pro_cta_clicked',
  CHECKOUT_ATTRIBUTION_GATE_SHOWN: 'checkout_attribution_gate_shown',

  // Builder
  BUILDER_OPENED: 'builder_opened',
  BUILDER_SAVED: 'builder_saved',
  BUILDER_SHARED: 'builder_shared',

  // Affiliate
  AFFILIATE_CLICK: 'affiliate_click',
} as const;

export type WebEventName = (typeof WebEvent)[keyof typeof WebEvent];

type WebEventProperties = {
  [WebEvent.FILTER_APPLIED]: { dimension: string; value: string; resultCount: number };
  [WebEvent.SORT_CHANGED]: { sortBy: string; direction: 'asc' | 'desc' };
  [WebEvent.MAP_VIEW_TOGGLED]: { enabled: boolean };
  [WebEvent.TRIP_SAVED_ANONYMOUS]: { tripSlug: string };
  [WebEvent.EMAIL_CAPTURE_MODAL_SHOWN]: { trigger: 'save' | 'gpx' | 'builder' };
  [WebEvent.EMAIL_CAPTURED_POST_SAVE]: { trigger: 'save' | 'gpx' | 'builder' };
  [WebEvent.GPX_DOWNLOAD_ATTEMPTED]: { tripSlug: string; isPro: boolean };
  [WebEvent.GPX_DOWNLOAD_DENIED]: { tripSlug: string; reason: 'not_authenticated' | 'not_pro' };
  [WebEvent.GPX_PREVIEW_SHOWN]: { tripSlug: string };
  [WebEvent.PRO_CTA_CLICKED]: {
    source: 'trip_detail' | 'builder' | 'explore' | 'gpx_preview';
    tripSlug?: string;
  };
  [WebEvent.CHECKOUT_ATTRIBUTION_GATE_SHOWN]: { tripSlug?: string; source: string };
  [WebEvent.BUILDER_OPENED]: { source: 'explore' | 'trip_detail' | 'nav' };
  [WebEvent.BUILDER_SAVED]: { waypointCount: number; distanceKm: number };
  [WebEvent.BUILDER_SHARED]: { method: 'link' | 'social'; tripSlug: string };
  [WebEvent.AFFILIATE_CLICK]: { provider: 'booking' | 'eaglerider' | 'revzilla'; tripSlug: string };
};

/** Events that carry typed properties. */
type TypedEvent = keyof WebEventProperties;

/** Events that have no required properties. */
type UntypedEvent = Exclude<WebEventName, TypedEvent>;

export function trackEvent<E extends TypedEvent>(event: E, properties: WebEventProperties[E]): void;
export function trackEvent(event: UntypedEvent, properties?: Record<string, unknown>): void;
export function trackEvent(event: WebEventName, properties?: Record<string, unknown>): void;
export function trackEvent(event: WebEventName, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}

export function resetUser() {
  posthog.reset();
}

// Legacy gtag-compatible helpers (now routed through PostHog)
export function trackAppStoreClick(platform: 'ios' | 'android') {
  trackEvent(WebEvent.APP_STORE_CLICK, { platform });
}

export function trackWaitlistSignup() {
  trackEvent(WebEvent.WAITLIST_SIGNUP);
}

export function trackBlogRead(slug: string) {
  trackEvent(WebEvent.BLOG_ARTICLE_READ, { article_slug: slug });
}
