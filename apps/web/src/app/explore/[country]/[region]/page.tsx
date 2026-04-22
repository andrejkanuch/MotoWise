import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { RouteCard } from '@/components/marketing/route-card';
import { BASE_URL, getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { type TripTemplateNode, fetchRegionBySlug, fetchRoutesByRegion, fetchTripTemplatesByRegion } from '@/lib/fetch-places';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ country: string; region: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug, region: regionSlug } = await params;
  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) return {};

  const { country, region } = result;
  const title = `Motorcycle Routes in ${region.name}, ${country.name}`;
  const routeCount = region.routeCount;
  const description =
    routeCount > 0
      ? `Explore ${routeCount} motorcycle route${routeCount === 1 ? '' : 's'} in ${region.name}, ${country.name}. Twisty roads, scenic passes, and rides rated by the community.`
      : `Motorcycle routes in ${region.name}, ${country.name} are coming soon. Browse nearby regions on MotoVault.`;

  const canonical = getCanonicalUrl('en', `/explore/${countrySlug}/${regionSlug}`);
  const pagePath = `/explore/${countrySlug}/${regionSlug}` as const;

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

  return base;
}

function getDifficultyDisplay(difficulty: string): { label: string; colorClass: string } {
  switch (difficulty) {
    case 'expert':
      return { label: 'Expert', colorClass: 'bg-red-500/15 text-red-400' };
    case 'hard':
      return { label: 'Hard', colorClass: 'bg-orange-500/15 text-orange-400' };
    case 'moderate':
      return { label: 'Moderate', colorClass: 'bg-yellow-500/15 text-yellow-400' };
    default:
      return { label: 'Easy', colorClass: 'bg-green-500/15 text-green-400' };
  }
}

function TripTemplateCard({ trip }: { trip: TripTemplateNode }) {
  const diff = getDifficultyDisplay(trip.difficulty);
  const href =
    trip.slug && trip.countryCode && trip.regionCode
      ? `/trips/${trip.countryCode.toLowerCase()}/${trip.regionCode.toLowerCase()}/${trip.slug}`
      : `/trips/${trip.id}`;

  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800/40 bg-neutral-900/40 p-5 transition-all duration-300 hover:border-neutral-700/60 hover:bg-neutral-900/60"
    >
      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50 transition-colors group-hover:text-warm-400">
        {trip.title}
      </h3>
      {trip.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-neutral-400">{trip.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-300">
        {trip.distanceM != null && trip.distanceM > 0 && (
          <span>{Math.round(trip.distanceM / 1000)} km</span>
        )}
        {trip.dayCount != null && trip.dayCount > 1 && <span>{trip.dayCount} days</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diff.colorClass}`}>
          {diff.label}
        </span>
        {trip.averageRating != null && trip.reviewCount > 0 && (
          <span className="text-xs text-neutral-400">
            {trip.averageRating.toFixed(1)} ({trip.reviewCount})
          </span>
        )}
      </div>
    </a>
  );
}

export default async function RegionPage({ params }: PageProps) {
  const { country: countrySlug, region: regionSlug } = await params;

  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) notFound();

  const { country, region } = result;
  const [routes, tripTemplates] = await Promise.all([
    fetchRoutesByRegion(country.countryCode, regionSlug),
    fetchTripTemplatesByRegion(country.countryCode, regionSlug),
  ]);

  const title = `Motorcycle Routes in ${region.name}, ${country.name}`;
  const description = `Explore ${region.routeCount} motorcycle routes in ${region.name}, ${country.name}.`;
  const canonical = getCanonicalUrl('en', `/explore/${countrySlug}/${regionSlug}`);
  const pageKey = `/explore/${countrySlug}/${regionSlug}`;

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: title,
      description,
      locale: 'en',
      pageKey,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: BASE_URL },
        { name: 'Explore', url: getCanonicalUrl('en', '/explore') },
        { name: country.name, url: getCanonicalUrl('en', `/explore/${countrySlug}`) },
        { name: region.name, url: canonical },
      ],
      'en',
      pageKey,
    ),
    {
      '@type': 'CollectionPage',
      '@id': `${BASE_URL}/#/explore/${countrySlug}/${regionSlug}/collection`,
      name: title,
      description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', url: BASE_URL },
      numberOfItems: routes.length + tripTemplates.length,
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

      {/* Trip templates */}
      {tripTemplates.length > 0 && (
        <section className="px-6 pb-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-xl font-bold text-neutral-50">Trip Templates</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tripTemplates.map((trip) => (
                <TripTemplateCard key={trip.id} trip={trip} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Routes (legacy) */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          {routes.length === 0 && tripTemplates.length === 0 ? (
            <p className="text-center text-neutral-500">
              No routes available in {region.name} yet. Check back soon!
            </p>
          ) : routes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
