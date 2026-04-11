import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { BIKE_FIXTURES } from '@/lib/bikes/bike-data';
import { scoreBikePage } from '@/lib/bikes/quality-gate';
import { getArticles } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';

const host = BASE_URL;
const locales = routing.locales;

const featureImages: Record<string, string> = {
  '/features/trip-planning': `${host}/screenshots/trip-planning-new.png`,
  '/features/ai-diagnostics': `${host}/screenshots/diagnose-hub.png`,
  '/features/learning-paths': `${host}/screenshots/home-alerts-articles.png`,
  '/features/garage-management': `${host}/screenshots/garage.png`,
  '/features/progress-tracking': `${host}/screenshots/home-dashboard.png`,
};

const pages = [
  '/',
  '/privacy',
  '/terms',
  '/support',
  '/account-deletion',
  '/features',
  '/features/trip-planning',
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
  '/compare/motovault-vs-kurviger',
  '/compare/motovault-vs-eatsleepride',
  '/compare/motovault-vs-scenic',
  '/compare/motovault-vs-motoscan',
  '/bikes',
  '/press',
  '/about',
];

function getLocalizedUrl(locale: string, path: string): string {
  const cleanPath = path === '/' ? '' : path;
  return locale === 'en' ? `${host}${cleanPath}` : `${host}/${locale}${cleanPath}`;
}

/** Approximate last-edit dates for static pages (avoids misleading crawlers with build timestamps). */
const PAGE_LAST_EDITED: Record<string, string> = {
  '/': '2026-04-11',
  '/privacy': '2026-03-14',
  '/terms': '2026-03-14',
  '/support': '2026-03-01',
  '/account-deletion': '2026-03-01',
  '/features': '2026-04-11',
  '/features/trip-planning': '2026-04-11',
  '/features/ai-diagnostics': '2026-04-11',
  '/features/learning-paths': '2026-04-11',
  '/features/garage-management': '2026-04-11',
  '/features/progress-tracking': '2026-04-11',
  '/blog': '2026-04-11',
  '/tools/cost-calculator': '2026-03-22',
  '/tools/tclocs-checklist': '2026-03-22',
  '/compare': '2026-04-11',
  '/compare/alternatives': '2026-04-11',
  '/compare/maintenance-vs-ride-apps': '2026-03-27',
  '/compare/motovault-vs-ridelog': '2026-04-11',
  '/compare/motovault-vs-rever': '2026-04-11',
  '/compare/motovault-vs-calimoto': '2026-04-11',
  '/compare/motovault-vs-kurviger': '2026-04-11',
  '/compare/motovault-vs-eatsleepride': '2026-04-11',
  '/compare/motovault-vs-scenic': '2026-04-11',
  '/compare/motovault-vs-motoscan': '2026-04-11',
  '/bikes': '2026-04-11',
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
    lastModified: new Date(PAGE_LAST_EDITED[path] || '2026-04-11'),
    images: getPageImages(path),
    alternates: {
      languages: Object.fromEntries([
        ...locales.map((locale) => [locale, getLocalizedUrl(locale, path)]),
        ['x-default', getLocalizedUrl('en', path)],
      ]),
    },
  }));

  // Blog posts: only emit hreflang alternates for locales that actually have
  // a translated MDX file for the same slug. Prevents Google from seeing
  // reciprocity errors for locales that fall back to English.
  const articlesByLocale: Record<string, Set<string>> = Object.fromEntries(
    locales.map((locale) => [locale, new Set(getArticles(locale).map((a) => a.slug))]),
  );

  const englishArticles = getArticles('en');
  const blogEntries = englishArticles.map((article) => {
    const localesWithTranslation = locales.filter((locale) =>
      articlesByLocale[locale]?.has(article.slug),
    );
    return {
      url: getLocalizedUrl('en', `/blog/${article.slug}`),
      lastModified: new Date(article.dateModified ?? article.date),
      images: article.heroImage ? [`${host}${article.heroImage}`] : [`${host}/og-image.png`],
      alternates: {
        languages: Object.fromEntries([
          ...localesWithTranslation.map((locale) => [
            locale,
            getLocalizedUrl(locale, `/blog/${article.slug}`),
          ]),
          ['x-default', getLocalizedUrl('en', `/blog/${article.slug}`)],
        ]),
      },
    };
  });

  // Bike pages: English-only per programmatic SEO plan. Only include pages
  // that pass the quality gate so sitemap inclusion is a positive signal.
  const bikeEntries = BIKE_FIXTURES.filter((page) => scoreBikePage(page, BIKE_FIXTURES).passes).map(
    (page) => ({
      url: `${host}/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/${page.pageType}`,
      lastModified: new Date('2026-04-11'),
    }),
  );

  return [...staticEntries, ...blogEntries, ...bikeEntries];
}
