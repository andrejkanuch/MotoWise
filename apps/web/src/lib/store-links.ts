// Client-side platform detection for "download the app" CTAs. The store URLs
// themselves live in store-buttons.tsx (STORE_LINKS), which owns the shared
// anchor every CTA delegates to; this module only answers "which store?".

export type Platform = 'ios' | 'android' | 'unknown';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  // iPadOS 13+ reports a desktop "Macintosh" UA — a touch-capable Mac is really
  // an iPad. A genuine (non-touch) Mac is desktop, NOT iOS: classifying it as
  // iOS wrongly hid the sticky app bar from macOS visitors and sent desktop
  // clicks to the App Store by default.
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}
