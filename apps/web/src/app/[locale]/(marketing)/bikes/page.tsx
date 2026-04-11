import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { BIKE_FIXTURES, PAGE_TYPES, type PageType } from '@/lib/bikes/bike-data';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const dynamic = 'force-static';
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

const PAGE_TITLE = 'Motorcycle Guides by Make, Model & Year';
const PAGE_DESCRIPTION =
  'Owner-oriented guides for popular motorcycles: real maintenance schedules, common problems, cost of ownership and service intervals.';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const canonical = getCanonicalUrl(locale, '/bikes');
  return {
    title: `${PAGE_TITLE} | MotoVault`,
    description: PAGE_DESCRIPTION,
    alternates: {
      canonical,
      // Bike pages are English-only for MVP. No hreflang variants yet.
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

function pageTypeLabel(pageType: PageType): string {
  switch (pageType) {
    case 'overview':
      return 'Overview';
    case 'maintenance-schedule':
      return 'Maintenance Schedule';
    case 'common-problems':
      return 'Common Problems';
    case 'cost-of-ownership':
      return 'Cost of Ownership';
    case 'service-intervals':
      return 'Service Intervals';
  }
}

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

      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span className="text-neutral-300" aria-current="page">
              Bikes
            </span>
          </li>
        </ol>
      </nav>

      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {PAGE_TITLE}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">{PAGE_DESCRIPTION}</p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl space-y-10">
          {bikes.map((bike) => (
            <article
              key={`${bike.makeSlug}-${bike.modelSlug}-${bike.year}`}
              className="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-6 md:p-8"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-50">
                {bike.year} {bike.make} {bike.model}
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {PAGE_TYPES.map((pageType) => (
                  <li key={pageType}>
                    <Link
                      href={`/bikes/${bike.makeSlug}/${bike.modelSlug}/${bike.year}/${pageType}`}
                      className="block rounded-lg border border-neutral-800/60 bg-neutral-950/60 px-4 py-3 text-sm text-neutral-300 transition-colors hover:border-warm-500/40 hover:text-neutral-100"
                    >
                      {pageTypeLabel(pageType)}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
