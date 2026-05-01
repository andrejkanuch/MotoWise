import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { BASE_URL, getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import {
  fetchRegionBySlug,
  fetchTripTemplatesByRegion,
  type TripTemplateNode,
} from '@/lib/fetch-places';
import { buildStaticMapUrl } from '@/lib/map/static-image-provider';
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

function buildThumbnailUrl(polyline: string, width: number, height: number): string {
  return buildStaticMapUrl({
    polyline,
    width,
    height,
    strokeColor: 'D4622E',
    strokeWidth: 3,
    strokeOpacity: 0.9,
    retina: true,
    padding: 40,
  });
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function TripTemplateCard({ trip }: { trip: TripTemplateNode }) {
  const diff = getDifficultyDisplay(trip.difficulty);
  const href =
    trip.slug && trip.countryCode && trip.regionCode
      ? `/trips/${trip.countryCode.toLowerCase()}/${trip.regionCode.toLowerCase()}/${trip.slug}`
      : `/trips/${trip.id}`;
  const mapUrl = trip.polyline ? buildThumbnailUrl(trip.polyline, 400, 240) : '';

  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800/40 bg-neutral-900/40 transition-all duration-300 hover:border-neutral-700/60 hover:bg-neutral-900/60"
    >
      {/* Map thumbnail */}
      <div className="relative aspect-[5/3] w-full overflow-hidden">
        {mapUrl ? (
          <Image
            src={mapUrl}
            alt={`Route map of ${trip.title}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800/80 to-neutral-900">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="size-10 text-neutral-700"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-950/60 to-transparent" />
        {trip.dayCount != null && trip.dayCount > 1 && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-warm-500/20 px-2.5 py-1 text-xs font-semibold text-warm-400 backdrop-blur-sm">
            {trip.dayCount}-day trip
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50 transition-colors group-hover:text-warm-400">
          {trip.title}
        </h3>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-300">
          {trip.distanceM != null && trip.distanceM > 0 && (
            <span>{formatDistance(trip.distanceM)}</span>
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
      </div>
    </a>
  );
}

export default async function RegionPage({ params }: PageProps) {
  const { country: countrySlug, region: regionSlug } = await params;

  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) notFound();

  const { country, region } = result;
  const tripTemplates = await fetchTripTemplatesByRegion(country.countryCode, regionSlug).catch(
    () => [],
  );

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
      numberOfItems: tripTemplates.length,
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

      {/* Trips */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          {tripTemplates.length === 0 ? (
            <p className="text-center text-neutral-500">
              No routes available in {region.name} yet. Check back soon!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tripTemplates.map((trip) => (
                <TripTemplateCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
