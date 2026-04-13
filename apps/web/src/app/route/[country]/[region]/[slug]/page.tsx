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
  if (!meters || meters <= 0) return '—';
  const km = meters / 1000;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatElevation(meters: number): string {
  if (meters == null || meters <= 0) return 'Flat';
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

function formatRideTime(distanceM: number, surfaceType?: string | null): string {
  if (!distanceM || distanceM <= 0) return '—';
  const avgSpeedKmh = surfaceType === 'off-road' ? 25 : surfaceType === 'mixed' ? 40 : 60;
  const hours = distanceM / 1000 / avgSpeedKmh;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
        <section className="relative h-80 w-full overflow-hidden sm:h-[28rem] md:h-[32rem]" aria-label="Route hero">
          {/* Change 2: hero entrance — GPU-composited scale animation */}
          <div
            className="absolute inset-0 animate-hero-scale bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 to-transparent"
            aria-hidden="true"
          />
          {/* Change 3: hero text fade-in-up entrance */}
          <div className="absolute bottom-6 left-6 right-6 animate-fade-in-up motion-reduce:animate-none sm:bottom-8 sm:left-8 sm:right-8">
            <h1 className="line-clamp-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              {route.name ?? 'Unnamed Route'}
            </h1>
            {route.contributor && (
              <p className="mt-2 text-sm text-neutral-300">
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
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-3 sm:gap-6 sm:px-8 md:grid-cols-6">
            <StatItem label="Distance" value={formatDistance(route.distanceM)} />
            {route.elevationGainM != null && (
              <StatItem label="Climbing" value={formatElevation(route.elevationGainM)} />
            )}
            {route.surfaceType && (
              <StatItem label="Surface" value={formatSurfaceType(route.surfaceType)} />
            )}
            {route.curvatureIndex != null && (
              <StatItem label="Curves" value={formatTwistScore(route.curvatureIndex)} />
            )}
            <StatItem
              label="Rating"
              value={route.ratingAvg != null ? `${route.ratingAvg.toFixed(1)} / 5` : '—'}
              detail={route.ratingCount ? `${route.ratingCount} reviews` : undefined}
            />
            <StatItem label="Ride Time" value={formatRideTime(route.distanceM, route.surfaceType)} />
          </div>
        </section>

        {/* Content */}
        <div className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-12">
          {/* Description */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-100">About this route</h2>
            {route.description || route.editorialDescription ? (
              <p className="max-w-prose whitespace-pre-line break-words leading-relaxed text-neutral-300">
                {route.editorialDescription ?? route.description}
              </p>
            ) : (
              <p className="text-neutral-400 italic">
                No description yet. Ride it and share your experience.
              </p>
            )}
          </section>

          {/* Badges — Change 5: bg-signature-500/20 → /30 for sunlight; Change 6: pulse-once delight */}
          {route.isMotovaultPick && (
            <div className="mb-8">
              <span className="inline-flex animate-pulse-once items-center rounded-full bg-signature-500/30 px-3 py-1 text-sm font-medium text-signature-300 motion-reduce:animate-none">
                Editor's Pick
              </span>
            </div>
          )}

          {/* CTA Buttons — Change 4: GPU transitions; Change 7: hover lift on primary */}
          <section className="flex flex-wrap gap-4">
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-neutral-50 shadow-[0_0_12px_rgba(var(--color-primary-600),0.3)] transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:bg-primary-500 hover:shadow-[0_0_20px_rgba(var(--color-primary-500),0.4)] active:scale-95 active:bg-primary-700 motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <DownloadIcon />
              Download GPX
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-neutral-800 px-6 py-3 text-base font-medium text-neutral-200 transition-[transform,background-color] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:bg-neutral-700 active:scale-95 active:bg-neutral-600 motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <BookmarkIcon />
              Save Route
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-neutral-800 px-6 py-3 text-base font-medium text-neutral-200 transition-[transform,background-color] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:bg-neutral-700 active:scale-95 active:bg-neutral-600 motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <ShareIcon />
              Share Route
            </button>
          </section>
        </div>
      </main>
    </>
  );
}

{/* Change 1: neutral-300 → neutral-200 for sunlight contrast; Change 8: detail sub-label */}
function StatItem({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium uppercase tracking-wide text-neutral-200">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums text-neutral-50">{value}</span>
      {detail && <span className="text-xs text-neutral-400">{detail}</span>}
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg
      className="h-5 w-5"
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
      className="h-5 w-5"
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
      className="h-5 w-5"
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
