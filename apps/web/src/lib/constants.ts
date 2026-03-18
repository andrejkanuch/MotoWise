/**
 * Base URL for the site — used in sitemap, robots.txt, JSON-LD, and Open Graph metadata.
 * Falls back to the production URL when the env var is not set.
 */
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://motovault.app';

/** Returns the canonical URL for a given locale and path. */
export function getCanonicalUrl(locale: string, path = ''): string {
  return locale === 'en' ? `${BASE_URL}${path}` : `${BASE_URL}/${locale}${path}`;
}
