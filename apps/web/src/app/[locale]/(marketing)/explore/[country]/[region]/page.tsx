import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { RouteCard } from '@/components/marketing/route-card';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { fetchRegionBySlug, fetchRoutesByRegion } from '@/lib/fetch-places';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 3600; // 1 hour

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ locale: string; country: string; region: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, country: countrySlug, region: regionSlug } = await params;
  setRequestLocale(locale);

  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) return {};

  const { country, region } = result;
  const title = `Motorcycle Routes in ${region.name}, ${country.name}`;
  const routeCount = region.routeCount;
  const description =
    routeCount > 0
      ? `Explore ${routeCount} motorcycle route${routeCount === 1 ? '' : 's'} in ${region.name}, ${country.name}. Find the best twisty roads, scenic passes, and rides rated by the community.`
      : `Motorcycle routes in ${region.name}, ${country.name} are coming soon. Browse nearby regions on MotoVault.`;

  // Explore content is not translated — always canonical to the non-localized version
  // to prevent Google from seeing locale variants as duplicates.
  const canonical = `${BASE_URL}/explore/${countrySlug}/${regionSlug}`;

  const base: Metadata = {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: {
      canonical,
      languages: { 'x-default': canonical },
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

  if (routeCount === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }

  return base;
}

export default async function RegionPage({ params }: PageProps) {
  const { locale, country: countrySlug, region: regionSlug } = await params;
  setRequestLocale(locale);

  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) notFound();

  const { country, region } = result;
  const routes = await fetchRoutesByRegion(country.countryCode, regionSlug);

  const title = `Motorcycle Routes in ${region.name}, ${country.name}`;
  const description = `Explore ${region.routeCount} motorcycle routes in ${region.name}, ${country.name}.`;
  const canonical = getCanonicalUrl(locale, `/explore/${countrySlug}/${regionSlug}`);

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: title,
      description,
      locale,
      pageKey: `/explore/${countrySlug}/${regionSlug}`,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Explore', url: getCanonicalUrl(locale, '/explore') },
        { name: country.name, url: getCanonicalUrl(locale, `/explore/${countrySlug}`) },
        { name: region.name, url: canonical },
      ],
      locale,
      `/explore/${countrySlug}/${regionSlug}`,
    ),
    // CollectionPage for rich results
    {
      '@type': 'CollectionPage',
      '@id': `${BASE_URL}/#/explore/${countrySlug}/${regionSlug}/collection`,
      name: title,
      description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', url: BASE_URL },
      numberOfItems: routes.length,
    },
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Explore', href: '/explore' },
          { label: country.name, href: `/explore/${countrySlug}` },
          { label: region.name },
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
          <p className="mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {region.routeCount} {region.routeCount === 1 ? 'route' : 'routes'} in {region.name}.
            Sorted by community rating.
          </p>
        </div>
      </section>

      {/* Routes grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          {routes.length === 0 ? (
            <p className="text-center text-neutral-500">
              No routes available in {region.name} yet. Check back soon!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
