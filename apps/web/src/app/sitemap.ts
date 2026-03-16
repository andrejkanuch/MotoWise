import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getArticles } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';

const host = BASE_URL;
const locales = routing.locales;

const featureImages: Record<string, string> = {
  '/features/ai-diagnostics': `${host}/og-image.png`,
  '/features/learning-paths': `${host}/og-image.png`,
  '/features/garage-management': `${host}/og-image.png`,
  '/features/progress-tracking': `${host}/og-image.png`,
};

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
  '/tools/cost-calculator',
  '/tools/tclocs-checklist',
  '/press',
];

function getLocalizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  return locale === 'en' ? `${host}${cleanPath}` : `${host}/${locale}${cleanPath}`;
}

function getPagePriority(path: string): number {
  if (path === '/') return 1;
  if (path === '/blog' || path.startsWith('/features/')) return 0.8;
  if (path.startsWith('/tools/')) return 0.7;
  if (path === '/press') return 0.5;
  if (path === '/support') return 0.5;
  return 0.3;
}

function getPageImages(path: string): string[] {
  if (path === '/') return [`${host}/og-image.png`];
  if (featureImages[path]) return [featureImages[path]];
  return [];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = pages.map((path) => ({
    url: getLocalizedUrl('en', path),
    lastModified: new Date(),
    changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: getPagePriority(path),
    images: getPageImages(path),
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, path)]),
        ['x-default', getLocalizedUrl('en', path)],
      ]),
    },
  }));

  const articles = getArticles('en');
  const blogEntries = articles.map((article) => ({
    url: getLocalizedUrl('en', `/blog/${article.slug}`),
    lastModified: new Date(article.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
    images: article.heroImage ? [`${host}${article.heroImage}`] : [`${host}/og-image.png`],
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, `/blog/${article.slug}`)]),
        ['x-default', getLocalizedUrl('en', `/blog/${article.slug}`)],
      ]),
    },
  }));

  return [...staticEntries, ...blogEntries];
}
