import { SitemapPublishedTripsDocument } from '@motovault/graphql';
import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { BIKE_FIXTURES } from '@/lib/bikes/bike-data';
import { scoreBikePage } from '@/lib/bikes/quality-gate';
import { getArticles } from '@/lib/blog';
import { BASE_URL } from '@/lib/constants';
import { gqlServerFetcher } from '@/lib/graphql-server';
import { exploreDiscoveryEntries, tripDetailEntries } from '@/lib/seo/sitemap-trips';

const host = BASE_URL;
const locales = routing.locales;

const featureImages: Record<string, string> = {
  '/features/trip-planning': `${host}/screenshots/trip-planning-new.png`,
  '/features/ai-diagnostics': `${host}/screenshots/diagnose-hub.png`,
  '/features/learning-paths': `${host}/screenshots/home-alerts-articles.png`,
  '/features/garage-management': `${host}/screenshots/garage.png`,
  '/features/maintenance': `${host}/screenshots/flow-add-maintenance.png`,
  '/features/expense-tracking': `${host}/screenshots/home-rides-expenses.png`,
  '/features/ride-tracking': `${host}/screenshots/home-rides-expenses.png`,
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
  '/features/maintenance',
  '/features/expense-tracking',
  '/features/ride-tracking',
  '/explore',
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
  '/compare/motovault-vs-motormanage',
  '/compare/motovault-vs-moto-shed',
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
  '/features/ai-diagnostics': '2026-06-01',
  '/features/learning-paths': '2026-04-11',
  '/features/garage-management': '2026-04-11',
  '/features/maintenance': '2026-06-01',
  '/features/expense-tracking': '2026-06-01',
  '/features/ride-tracking': '2026-06-01',
  '/explore': '2026-06-01',
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
  '/compare/motovault-vs-motormanage': '2026-04-18',
  '/compare/motovault-vs-moto-shed': '2026-04-18',
  '/press': '2026-03-01',
  '/about': '2026-03-22',
};

function getPageImages(path: string): string[] {
  if (path === '/') return [`${host}/og-image.png`];
  if (featureImages[path]) return [featureImages[path]];
  return [];
}

/**
 * All published trips — powers both the `/trips/` detail URLs and the explore
 * country/region discovery pages. Uses `sitemapPublishedTrips` (returns every
 * published trip) rather than the paginated `tripTemplates` query, which is
 * capped at 50 per page server-side and silently dropped ~85% of live trip
 * pages from the sitemap.
 */
async function getPublishedTripsForSitemap() {
  try {
    const data = await gqlServerFetcher(SitemapPublishedTripsDocument);
    return data.sitemapPublishedTrips;
  } catch (err) {
    // One fetch backs every trip + explore URL, so a silent [] would drop all of
    // them and read as "no trips". Log so the failure is visible; the empty
    // result still degrades gracefully (static + blog + bike URLs are unaffected).
    console.error('[sitemap] sitemapPublishedTrips failed — trip + explore URLs omitted', err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    await Promise.all(
      locales.map(
        async (locale) =>
          [locale, new Set((await getArticles(locale)).map((a) => a.slug))] as const,
      ),
    ),
  );

  const englishArticles = await getArticles('en');
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

  // Bike pages: English-only per programmatic SEO plan. No hreflang alternates —
  // translating 1500+ templated pages is deferred until tier-1 is traffic-proven.
  // Only include pages that pass the quality gate so sitemap inclusion is a positive
  // signal. The `/bikes` index itself is included here (not in the locale-mapped
  // `pages` array) so it doesn't accidentally emit alternates for locales that
  // don't have a translated version.
  const bikeIndexEntry = {
    url: `${host}/bikes`,
    lastModified: new Date('2026-04-11'),
  };
  const bikeLeafEntries = BIKE_FIXTURES.filter(
    (page) => scoreBikePage(page, BIKE_FIXTURES).passes,
  ).map((page) => ({
    url: `${host}/bikes/${page.makeSlug}/${page.modelSlug}/${page.year}/${page.pageType}`,
    lastModified: new Date('2026-04-11'),
  }));

  // ---- Trip detail pages + explore discovery (one fetch, both derived) ----
  const publishedTrips = await getPublishedTripsForSitemap();
  const now = new Date();
  const tripTemplateEntries = tripDetailEntries(publishedTrips, now);
  const exploreEntries = exploreDiscoveryEntries(publishedTrips, now);

  return [
    ...staticEntries,
    ...blogEntries,
    bikeIndexEntry,
    ...bikeLeafEntries,
    ...tripTemplateEntries,
    ...exploreEntries,
  ];
}
