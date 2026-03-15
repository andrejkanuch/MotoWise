import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getArticleSlugs } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';

const host = BASE_URL;
const locales = routing.locales;
const pages = [
  '/',
  '/privacy',
  '/terms',
  '/support',
  '/account-deletion',
  '/features/ai-diagnostics',
  '/features/learning-paths',
  '/features/garage-management',
  '/features/progress-tracking',
  '/blog',
];

function getLocalizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  return locale === 'en' ? `${host}${cleanPath}` : `${host}/${locale}${cleanPath}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = pages.map((path) => ({
    url: getLocalizedUrl('en', path),
    lastModified: new Date(),
    changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
    priority:
      path === '/'
        ? 1
        : path === '/blog'
          ? 0.8
          : path.startsWith('/features/')
            ? 0.8
            : path === '/support'
              ? 0.5
              : 0.3,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, path)]),
        ['x-default', getLocalizedUrl('en', path)],
      ]),
    },
  }));

  const articleSlugs = getArticleSlugs();
  const blogEntries = articleSlugs.map((slug) => ({
    url: getLocalizedUrl('en', `/blog/${slug}`),
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, `/blog/${slug}`)]),
        ['x-default', getLocalizedUrl('en', `/blog/${slug}`)],
      ]),
    },
  }));

  return [...staticEntries, ...blogEntries];
}
