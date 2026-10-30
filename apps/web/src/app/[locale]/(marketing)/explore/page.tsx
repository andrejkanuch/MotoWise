import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { fetchCountries } from '@/lib/fetch-places';
import {
  buildBreadcrumbList,
  buildFAQPage,
  buildGraph,
  buildItemList,
  buildWebPage,
} from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

export const revalidate = 86400; // 24 hours

interface PageProps {
  params: Promise<{ locale: string }>;
}

const PAGE_TITLE = 'Motorcycle routes by country';
const PAGE_DESCRIPTION =
  'Motorcycle routes by country and region: mountain passes, coastal roads and multi-day touring routes, each with distance, climb and riding time, shared and rated by riders.';

// Explore is intentionally non-translated (English-only, canonical to /explore),
// so this route-discovery FAQ copy stays inline rather than going through i18n.
// The app has no turn-by-turn navigation: a route is opened in the app, exported
// as GPX and copied into the rider's planner.
const EXPLORE_FAQ = [
  {
    question: 'Are MotoVault routes free to browse?',
    answer:
      'Yes. Every motorcycle route on MotoVault is free to browse on the web, by country and region, with no account required. Opening a route in the MotoVault app for iOS and Android is free too.',
  },
  {
    question: 'Where do MotoVault routes come from?',
    answer:
      'Routes are shared by riders on MotoVault and rated by other riders, so the highest-rated passes, coastal roads and multi-day touring routes rise to the top of each country and region.',
  },
  {
    question: 'How do I ride a route I find on MotoVault?',
    answer:
      'Open the route in the free MotoVault app for iOS or Android, export the GPX and copy it into your planner. Distance, climb, surface and the rider rating are on the route page here before you go.',
  },
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  // Explore content is not translated — always canonical to the non-localized version
  // to prevent Google from seeing locale variants as duplicates.
  const canonical = `${BASE_URL}/explore`;
  return {
    title: { absolute: `${PAGE_TITLE} | MotoVault` },
    description: PAGE_DESCRIPTION,
    alternates: {
      canonical,
      languages: { 'x-default': `${BASE_URL}/explore` },
    },
  };
}

export default async function ExplorePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const countries = await fetchCountries();
  const canonical = getCanonicalUrl(locale, '/explore');
  const totalRoutes = countries.reduce((sum, country) => sum + country.routeCount, 0);

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      locale,
      pageKey: '/explore',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Explore', url: canonical },
      ],
      locale,
      '/explore',
    ),
    countries.length > 0
      ? buildItemList(
          countries.map((country) => ({
            name: country.name,
            url: getCanonicalUrl(locale, `/explore/${country.slug}`),
          })),
          `${locale}/explore`,
          'Motorcycle routes by country',
        )
      : null,
    buildFAQPage(EXPLORE_FAQ, `${locale}/explore/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <section className="mv-index">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Explore' }]} />

        <header>
          <h1 className="mv-index-h1">Motorcycle routes by country</h1>
          <p className="mv-index-lede">
            {totalRoutes > 0 ? (
              <>
                <span className="mv-figure">{totalRoutes.toLocaleString('en-US')}</span> routes
                shared and rated by riders, free to browse. Pick a country, then a region, and open
                any route in the app to export the GPX.
              </>
            ) : (
              <>
                Routes shared and rated by riders, free to browse. Pick a country, then a region,
                and open any route in the app to export the GPX.
              </>
            )}
          </p>
        </header>

        {countries.length === 0 ? (
          <p className="mv-empty">No routes published yet. Check back soon.</p>
        ) : (
          <ul className="mv-places">
            {countries.map((country) => (
              <li key={country.id}>
                <Link href={`/explore/${country.slug}`}>
                  <span className="mv-places-name">{country.name}</span>
                  <span className="mv-places-count">
                    <span className="mv-figure">{country.routeCount}</span>
                    {country.routeCount === 1 ? 'route' : 'routes'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="mv-read-section" aria-labelledby="explore-faq-heading">
          <h2 id="explore-faq-heading" className="mv-read-h2">
            Questions riders ask
          </h2>
          <div className="mv-read-faq">
            {EXPLORE_FAQ.map((item) => (
              <details key={item.question} className="mv-disclosure is-plus">
                <summary>
                  {item.question}
                  <svg
                    className="mv-disclosure-mark"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="mv-read-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
