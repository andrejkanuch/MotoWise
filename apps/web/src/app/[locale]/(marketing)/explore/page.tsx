import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { fetchCountries } from '@/lib/fetch-places';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 86400; // 24 hours

interface PageProps {
  params: Promise<{ locale: string }>;
}

const PAGE_TITLE = 'Explore Motorcycle Routes';
const PAGE_DESCRIPTION =
  'Discover the best motorcycle routes worldwide. Browse by country and region to find twisty roads, scenic passes, and epic rides.';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const canonical = getCanonicalUrl(locale, '/explore');
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
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Explore' }]} />

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Route Discovery
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {PAGE_TITLE}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">{PAGE_DESCRIPTION}</p>
        </div>
      </section>

      {/* Country grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          {countries.length === 0 ? (
            <p className="text-center text-neutral-500">
              No routes available yet. Check back soon!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <Link
                  key={country.id}
                  href={`/explore/${country.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                >
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />
                  <h2 className="text-lg font-semibold text-neutral-50 transition-colors group-hover:text-warm-400">
                    {country.name}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    {country.routeCount} {country.routeCount === 1 ? 'route' : 'routes'}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-warm-400 transition-colors group-hover:text-warm-300">
                    View regions
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
