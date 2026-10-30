import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { BIKE_FIXTURES, PAGE_TYPES, type PageType } from '@/lib/bikes/bike-data';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

export const dynamic = 'force-static';
export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

const PAGE_TITLE = 'Motorcycle guides by make, model and year';
const PAGE_DESCRIPTION =
  'Owner-oriented guides for popular motorcycles: real maintenance schedules, common problems, cost of ownership and service intervals.';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    // `absolute` bypasses the root layout's "%s | MotoVault" template so we don't
    // double-suffix. The root title.default is "MotoVault" so a single suffix is enough.
    title: { absolute: `${PAGE_TITLE} | MotoVault` },
    description: PAGE_DESCRIPTION,
    alternates: {
      // Bike pages are English-only for MVP — always canonical to unprefixed URL.
      canonical: `${BASE_URL}/bikes`,
      languages: { 'x-default': `${BASE_URL}/bikes` },
    },
  };
}

interface BikeGroup {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  year: number;
}

function groupBikes(): BikeGroup[] {
  const seen = new Map<string, BikeGroup>();
  for (const page of BIKE_FIXTURES) {
    const key = `${page.makeSlug}/${page.modelSlug}/${page.year}`;
    if (!seen.has(key)) {
      seen.set(key, {
        make: page.make,
        makeSlug: page.makeSlug,
        model: page.model,
        modelSlug: page.modelSlug,
        year: page.year,
      });
    }
  }
  return Array.from(seen.values());
}

const PAGE_TYPE_LABEL: Record<PageType, string> = {
  overview: 'Overview',
  'maintenance-schedule': 'Maintenance schedule',
  'common-problems': 'Common problems',
  'cost-of-ownership': 'Cost of ownership',
  'service-intervals': 'Service intervals',
};

export default async function BikesIndexPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const canonical = getCanonicalUrl(locale, '/bikes');
  const bikes = groupBikes();

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      locale,
      pageKey: '/bikes',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Bikes', url: canonical },
      ],
      locale,
      '/bikes',
    ),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <section className="mv-index">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Bikes' }]} />

        <header>
          <h1 className="mv-index-h1">Guides by make, model and year</h1>
          <p className="mv-index-lede">
            Owner guides for specific motorcycles: the maintenance schedule, the problems owners
            report, what the bike costs to run and when each service is due.
          </p>
        </header>

        <ul className="mv-bike-list">
          {bikes.map((bike) => (
            <li key={`${bike.makeSlug}-${bike.modelSlug}-${bike.year}`}>
              <span className="mv-bike-year">{bike.year}</span>
              <div>
                <h2 className="mv-bike-name">
                  {bike.make} {bike.model}
                </h2>
                <ul className="mv-bike-pages">
                  {PAGE_TYPES.map((pageType) => (
                    <li key={pageType}>
                      <Link
                        href={`/bikes/${bike.makeSlug}/${bike.modelSlug}/${bike.year}/${pageType}`}
                        className="mv-link is-quiet"
                      >
                        {PAGE_TYPE_LABEL[pageType]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
