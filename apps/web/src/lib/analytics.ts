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

// NOTE: events defined here MUST have a call site. Constants that were defined
// but never fired (explore/trip/bike page views, hero CTA, pricing, blog list,
// feed/kudos, error/friction, search, second-page/return-visitor) were removed
// in the 2026-05-30 PostHog audit — see docs/PostHog-Audit-2026-05-30.md. Re-add
// only when you wire the corresponding trackEvent() call.
export const WebEvent = {
  // Auth
  SIGN_IN_SUBMITTED: 'sign_in_submitted',
  SIGN_IN_ERROR: 'sign_in_error',
  SIGN_IN_OAUTH_CLICKED: 'sign_in_oauth_clicked',
  SIGN_UP_SUBMITTED: 'sign_up_submitted',
  SIGN_UP_ERROR: 'sign_up_error',
  SIGN_UP_OAUTH_CLICKED: 'sign_up_oauth_clicked',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',

  // Marketing / Conversion
  APP_STORE_CLICK: 'app_store_click',
  WAITLIST_SIGNUP: 'waitlist_signup',

  // Pricing / Checkout
  CHECKOUT_INITIATED: 'checkout_initiated',
  CHECKOUT_COMPLETED: 'checkout_completed',
  CHECKOUT_CANCELLED: 'checkout_cancelled',
  MANAGE_SUBSCRIPTION_CLICKED: 'manage_subscription_clicked',

  // Blog
  BLOG_ARTICLE_READ: 'blog_article_read',

  // Content Interaction
  OPEN_IN_APP_CLICKED: 'open_in_app_clicked',
  GPX_DOWNLOAD_CLICKED: 'gpx_download_clicked',
  ROUTE_SAVED_WEB: 'route_saved_web',
  SHARE_BUTTON_CLICKED: 'share_button_clicked',

  // Community
  PROFILE_VIEWED: 'profile_viewed',
  PROFILE_EDITED: 'profile_edited',
  GARAGE_VIEWED: 'garage_viewed',

  // Tools
  TOOL_USED: 'tool_used',

  // Consent
  CONSENT_GRANTED: '$consent_granted',

  // Review soft-wall
  REVIEW_SOFTWALL_SHOWN: 'review_softwall_shown',
  REVIEW_SOFTWALL_CTA_CLICKED: 'review_softwall_cta_clicked',

  // SEO / Content discovery
  SCROLL_DEPTH_50: 'scroll_depth_50',
  SCROLL_DEPTH_100: 'scroll_depth_100',
  TIME_ON_PAGE_30S: 'time_on_page_30s',
  TIME_ON_PAGE_60S: 'time_on_page_60s',

  // Engagement quality signals
  SESSION_PAGES_3_PLUS: 'session_pages_3_plus',

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

/** App-store platforms (no magic strings). */
export const StorePlatform = { Ios: 'ios', Android: 'android' } as const;
export type StorePlatform = (typeof StorePlatform)[keyof typeof StorePlatform];

/** Where a store CTA was clicked — the acquisition-funnel dimension. */
export const StoreLocation = { Cta: 'cta', Hero: 'hero', FeatureCta: 'feature_cta' } as const;
export type StoreLocation = (typeof StoreLocation)[keyof typeof StoreLocation];

type WebEventProperties = {
  [WebEvent.APP_STORE_CLICK]: {
    platform: StorePlatform;
    location?: StoreLocation;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
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
export function trackAppStoreClick(
  platform: StorePlatform,
  location?: StoreLocation,
  campaign?: { utm_source?: string; utm_medium?: string; utm_campaign?: string },
) {
  trackEvent(WebEvent.APP_STORE_CLICK, {
    platform,
    ...(location ? { location } : {}),
    ...(campaign?.utm_source ? { utm_source: campaign.utm_source } : {}),
    ...(campaign?.utm_medium ? { utm_medium: campaign.utm_medium } : {}),
    ...(campaign?.utm_campaign ? { utm_campaign: campaign.utm_campaign } : {}),
  });
}

export function trackWaitlistSignup() {
  trackEvent(WebEvent.WAITLIST_SIGNUP);
}

export function trackBlogRead(slug: string) {
  trackEvent(WebEvent.BLOG_ARTICLE_READ, { article_slug: slug });
}
