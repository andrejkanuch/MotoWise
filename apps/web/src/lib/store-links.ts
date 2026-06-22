// Canonical app store links + platform detection. Single source of truth so every web CTA
// ("Download Free", "Open in App") points at the real stores instead of the homepage.

export const STORE_URLS = {
  ios: 'https://apps.apple.com/us/app/motovault/id6760291360',
  android: 'https://play.google.com/store/apps/details?id=com.motovault.app',
} as const;

export type Platform = 'ios' | 'android' | 'unknown';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|macintosh/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}

/** Best store URL for a platform. Desktop/unknown defaults to the App Store (works in a browser). */
export function storeUrlForPlatform(platform: Platform): string {
  return platform === 'android' ? STORE_URLS.android : STORE_URLS.ios;
}
