// Client-side platform detection for "download the app" CTAs. The store URLs
// themselves live in store-buttons.tsx (STORE_LINKS), which owns the shared
// anchor every CTA delegates to; this module only answers "which store?".

export type Platform = 'ios' | 'android' | 'unknown';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|macintosh/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}
