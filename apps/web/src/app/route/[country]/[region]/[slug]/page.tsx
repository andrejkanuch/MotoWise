import type { RouteBySlugQuery } from '@motovault/graphql';
import { RouteBySlugDocument } from '@motovault/graphql';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/marketing/json-ld';
import { gqlServerFetcher } from '@/lib/graphql-server';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ country: string; region: string; slug: string }>;
}

type Route = NonNullable<RouteBySlugQuery['routeBySlug']>;

async function fetchRoute(country: string, region: string, slug: string): Promise<Route | null> {
  try {
    const data = await gqlServerFetcher(RouteBySlugDocument, { country, region, slug });
    return data.routeBySlug ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country, region, slug } = await params;
  const route = await fetchRoute(country, region, slug);

  if (!route) {
    return { title: 'Route Not Found' };
  }

  const title = route.name ?? 'Motorcycle Route';
  const description = route.description
    ? route.description.slice(0, 160)
    : 'Discover this motorcycle route on MotoVault.';
  const canonicalUrl = `https://motovault.app/route/${country}/${region}/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

function formatSurfaceType(surface: string): string {
  const labels: Record<string, string> = {
    paved: 'Paved',
    mixed: 'Mixed',
    'off-road': 'Off-Road',
    unknown: 'Unknown',
  };
  return labels[surface] ?? surface;
}

function formatTwistScore(curvatureIndex: number): string {
  if (curvatureIndex >= 50) return 'Extreme';
  if (curvatureIndex >= 30) return 'Twisty';
  if (curvatureIndex >= 15) return 'Moderate';
  return 'Straight';
}

export default async function RouteDetailPage({ params }: PageProps) {
  const { country, region, slug } = await params;
  const route = await fetchRoute(country, region, slug);

  if (!route) {
    notFound();
  }

  const canonicalUrl = `https://motovault.app/route/${country}/${region}/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: route.name,
    description: route.description?.slice(0, 160),
    url: canonicalUrl,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: route.startLat,
      longitude: route.startLng,
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: route.countryCode?.toUpperCase(),
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      <main className="min-h-screen bg-neutral-950 text-neutral-50">
        {/* Hero Section */}
        <section className="relative h-64 w-full overflow-hidden sm:h-80 md:h-96">
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-6 left-6 right-6 sm:bottom-8 sm:left-8 sm:right-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              {route.name ?? 'Unnamed Route'}
            </h1>
            {route.contributor && (
              <p className="mt-1 text-sm text-neutral-300">
                Shared by{' '}
                <span className="font-medium text-neutral-100">
                  {route.contributor.displayName}
                </span>
              </p>
            )}
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-b border-neutral-800 bg-neutral-900">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-6 py-4 sm:px-8">
            <StatItem label="Distance" value={formatDistance(route.distanceM)} />
            {route.elevationGainM != null && (
              <StatItem label="Elevation" value={formatElevation(route.elevationGainM)} />
            )}
            {route.surfaceType && (
              <StatItem label="Surface" value={formatSurfaceType(route.surfaceType)} />
            )}
            {route.curvatureIndex != null && (
              <StatItem label="Twist Score" value={formatTwistScore(route.curvatureIndex)} />
            )}
            {route.ratingAvg != null && (
              <StatItem
                label="Rating"
                value={`${route.ratingAvg.toFixed(1)} (${route.ratingCount})`}
              />
            )}
          </div>
        </section>

        {/* Content */}
        <div className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-12">
          {/* Description */}
          {(route.description || route.editorialDescription) && (
            <section className="mb-10">
              <h2 className="mb-3 text-lg font-semibold text-neutral-100">About this route</h2>
              <p className="whitespace-pre-line leading-relaxed text-neutral-300">
                {route.editorialDescription ?? route.description}
              </p>
            </section>
          )}

          {/* Badges */}
          <div className="mb-10 flex flex-wrap gap-2">
            {route.isMotovaultPick && (
              <span className="inline-flex items-center rounded-full bg-signature-500/15 px-3 py-1 text-xs font-medium text-signature-400">
                MotoVault Pick
              </span>
            )}
            {route.surfaceType && (
              <span className="inline-flex items-center rounded-full bg-primary-500/15 px-3 py-1 text-xs font-medium text-primary-300">
                {formatSurfaceType(route.surfaceType)}
              </span>
            )}
          </div>

          {/* CTA Buttons */}
          <section className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-neutral-50 transition-colors hover:bg-primary-500"
            >
              <BookmarkIcon />
              Save Route
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
            >
              <DownloadIcon />
              Download GPX
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
            >
              <ShareIcon />
              Share
            </button>
          </section>
        </div>
      </main>
    </>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</span>
      <span className="text-sm font-semibold text-neutral-100">{value}</span>
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      role="img"
      aria-label="Bookmark"
    >
      <title>Bookmark</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      role="img"
      aria-label="Download"
    >
      <title>Download</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      role="img"
      aria-label="Share"
    >
      <title>Share</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  );
}
