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
  '/compare',
  '/compare/alternatives',
  '/compare/maintenance-vs-ride-apps',
  '/compare/motovault-vs-ridelog',
  '/compare/motovault-vs-rever',
  '/compare/motovault-vs-calimoto',
  '/press',
  '/about',
];

function getLocalizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  return locale === 'en' ? `${host}${cleanPath}` : `${host}/${locale}${cleanPath}`;
}

/** Approximate last-edit dates for static pages (avoids misleading crawlers with build timestamps). */
const PAGE_LAST_EDITED: Record<string, string> = {
  '/': '2026-03-18',
  '/privacy': '2026-03-14',
  '/terms': '2026-03-14',
  '/support': '2026-03-01',
  '/account-deletion': '2026-03-01',
  '/features/ai-diagnostics': '2026-03-10',
  '/features/learning-paths': '2026-03-10',
  '/features/garage-management': '2026-03-10',
  '/features/progress-tracking': '2026-03-10',
  '/blog': '2026-03-16',
  '/tools/cost-calculator': '2026-03-22',
  '/tools/tclocs-checklist': '2026-03-22',
  '/compare': '2026-03-27',
  '/compare/alternatives': '2026-03-27',
  '/compare/maintenance-vs-ride-apps': '2026-03-27',
  '/compare/motovault-vs-ridelog': '2026-03-28',
  '/compare/motovault-vs-rever': '2026-03-28',
  '/compare/motovault-vs-calimoto': '2026-03-28',
  '/press': '2026-03-01',
  '/about': '2026-03-22',
};

function getPageImages(path: string): string[] {
  if (path === '/') return [`${host}/og-image.png`];
  if (featureImages[path]) return [featureImages[path]];
  return [];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = pages.map((path) => ({
    url: getLocalizedUrl('en', path),
    lastModified: new Date(PAGE_LAST_EDITED[path] || '2026-03-01'),
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
