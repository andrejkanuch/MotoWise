import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Base URL for the site — used in sitemap, robots.txt, JSON-LD, and Open Graph metadata.
 * Falls back to the production URL when the env var is not set.
 */
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://motovault.app';

/** Returns the canonical URL for a given locale and path. */
export function getCanonicalUrl(locale: string, path = ''): string {
  return locale === 'en' ? `${BASE_URL}${path}` : `${BASE_URL}/${locale}${path}`;
}

/**
 * Returns the `alternates.languages` map for Next.js `generateMetadata`, keyed
 * by locale and including `x-default` pointing at the default locale.
 *
 * Uses next-intl's `getPathname` so locale-specific rewrites (if any are ever
 * added via `pathnames`) stay in sync. For the default locale, `as-needed`
 * prefix mode returns the unprefixed path automatically.
 */
export function getHreflangMap(href: string): Record<string, string> {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, BASE_URL + getPathname({ locale, href })]),
  );
  return {
    ...languages,
    'x-default': BASE_URL + getPathname({ locale: routing.defaultLocale, href }),
  };
}
