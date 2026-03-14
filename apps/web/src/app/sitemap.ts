import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { BASE_URL } from '@/lib/constants';

const host = BASE_URL;
const locales = routing.locales;
const pages = ['/', '/privacy', '/terms', '/support', '/account-deletion'];

function getLocalizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  return locale === 'en' ? `${host}${cleanPath}` : `${host}/${locale}${cleanPath}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({
    url: getLocalizedUrl('en', path),
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/support' ? 0.5 : 0.3,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, path)]),
        ['x-default', getLocalizedUrl('en', path)],
      ]),
    },
  }));
}
