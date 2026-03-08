import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/constants';

const host = BASE_URL;
const locales = ['en', 'es', 'de'] as const;
const pages = ['/', '/privacy', '/terms'];

function getLocalizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  return locale === 'en' ? `${host}${cleanPath}` : `${host}/${locale}${cleanPath}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({
    url: getLocalizedUrl('en', path),
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.3,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, path)]),
        ['x-default', getLocalizedUrl('en', path)],
      ]),
    },
  }));
}
