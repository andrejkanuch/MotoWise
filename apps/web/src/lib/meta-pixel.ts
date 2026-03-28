const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function trackPageView() {
  if (!PIXEL_ID || typeof window === 'undefined' || typeof window.fbq === 'undefined') return;
  window.fbq('track', 'PageView');
}

export function trackEvent(event: MetaPixelStandardEvent, params?: MetaPixelContentParams) {
  if (!PIXEL_ID || typeof window === 'undefined' || typeof window.fbq === 'undefined') return;
  window.fbq('track', event, params);
}
