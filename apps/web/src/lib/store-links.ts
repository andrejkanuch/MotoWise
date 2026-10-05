// Store URLs and client-side platform detection for "download the app" CTAs.
// The shared anchor every CTA delegates to lives in store-buttons.tsx. The URLs
// live here, in a plain module, so Server Components (the /get page) can read
// them — a const exported from a 'use client' module is only a client reference
// on the server.

export const STORE_LINKS = {
  appStore: 'https://apps.apple.com/us/app/motovault/id6760291360',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.motovault.app',
} as const;

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

/**
 * Append a Google Play `referrer` param built from arbitrary key/values. Play
 * surfaces this verbatim in the Install Referrer API + Play Console acquisition
 * reports, giving deterministic Android channel attribution — and it is how blog
 * CTAs carry make/model intent across the store boundary (`mv_make`/`mv_model`,
 * plan P2.1). Undefined/empty values are dropped; returns the URL unchanged when
 * there is nothing to attribute.
 */
export function buildPlayReferrer(
  playUrl: string,
  params: Record<string, string | undefined> | null,
): string {
  const entries = params
    ? Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];
  if (entries.length === 0) return playUrl;
  // Encode each key AND value: URLSearchParams already decoded them, so a key or
  // value that itself contains `&`/`=` would otherwise split into extra pairs once
  // Play hands the (once-decoded) referrer string back to the app for parsing.
  const referrer = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  const separator = playUrl.includes('?') ? '&' : '?';
  return `${playUrl}${separator}referrer=${encodeURIComponent(referrer)}`;
}
