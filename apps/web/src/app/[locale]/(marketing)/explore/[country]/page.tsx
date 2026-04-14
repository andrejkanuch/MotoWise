import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { RouteCard } from '@/components/marketing/route-card';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import {
  fetchCountryBySlug,
  fetchRegionsByCountrySlug,
  fetchRoutesByCountry,
} from '@/lib/fetch-places';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 86400; // 24 hours

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ locale: string; country: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, country: countrySlug } = await params;
  setRequestLocale(locale);

  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return {};

  const title = `Motorcycle Routes in ${country.name}`;
  const rc = country.routeCount;
  const description =
    rc > 0
      ? `Discover the best motorcycle routes in ${country.name}. Browse ${rc} route${rc === 1 ? '' : 's'} across regions — twisty roads, scenic passes, and epic rides.`
      : `Motorcycle routes in ${country.name} are coming soon. Browse other countries on MotoVault or share a ride from the app.`;

  const canonical = getCanonicalUrl(locale, `/explore/${countrySlug}`);
  const pagePath = `/explore/${countrySlug}` as const;

  const base: Metadata = {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: {
      canonical,
      languages: getHreflangMap(pagePath),
    },
    openGraph: {
      title: `${title} | MotoVault`,
      description,
      url: canonical,
      siteName: 'MotoVault',
      type: 'website',
      images: [{ url: OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | MotoVault`,
      description,
      images: [OG_IMAGE],
    },
  };

  if (rc === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }

  return base;
}

export default async function CountryPage({ params }: PageProps) {
  const { locale, country: countrySlug } = await params;
  setRequestLocale(locale);

  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  const [regions, topRoutes] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchRoutesByCountry(country.countryCode, 12),
  ]);

  const title = `Motorcycle Routes in ${country.name}`;
  const description = `Discover the best motorcycle routes in ${country.name}. Browse ${country.routeCount} routes across regions.`;
  const canonical = getCanonicalUrl(locale, `/explore/${countrySlug}`);

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: title,
      description,
      locale,
      pageKey: `/explore/${countrySlug}`,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Explore', url: getCanonicalUrl(locale, '/explore') },
        { name: country.name, url: canonical },
      ],
      locale,
      `/explore/${countrySlug}`,
    ),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Explore', href: '/explore' },
          { label: country.name },
        ]}
      />

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {country.name}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">{description}</p>
        </div>
      </section>

      {/* Regions grid */}
      {regions.length > 0 && (
        <section className="px-6 pb-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-50">Regions</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regions.map((region) => (
                <Link
                  key={region.id}
                  href={`/explore/${countrySlug}/${region.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                >
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />
                  <h3 className="text-lg font-semibold text-neutral-50 transition-colors group-hover:text-warm-400">
                    {region.name}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-400">
                    {region.routeCount} {region.routeCount === 1 ? 'route' : 'routes'}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-warm-400 transition-colors group-hover:text-warm-300">
                    View routes
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
          </div>
        </section>
      )}

      {/* Top routes */}
      {topRoutes.length > 0 && (
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-50">
              Top Routes in {country.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topRoutes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {regions.length === 0 && topRoutes.length === 0 && (
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-neutral-500">
              No routes available in {country.name} yet. Check back soon!
            </p>
          </div>
        </section>
      )}
    </>
  );
}
