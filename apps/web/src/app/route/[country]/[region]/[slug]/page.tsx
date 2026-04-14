import { palette } from '@motovault/design-system';
import type { RouteBySlugPagePayload } from '@motovault/types';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { GpxDownloadButton } from '@/components/gpx-download-button';
import { RouteMapSection } from '@/components/route-map-section';
import { decodePolyline } from '@/lib/decode-polyline';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const ROUTE_BY_SLUG_QUERY = `
  query RouteBySlug($country: String!, $region: String!, $slug: String!) {
    routeBySlug(country: $country, region: $region, slug: $slug) {
      id
      name
      description
      polyline
      distanceM
      elevationGainM
      surfaceType
      curvatureIndex
      isMotovaultPick
      editorialDescription
      ratingAvg
      ratingCount
      commentCount
      status
      createdAt
      contributor {
        id
        displayName
        publicUsername
        avatarUrl
      }
    }
  }
`;

async function fetchRoute(
  country: string,
  region: string,
  slug: string,
): Promise<RouteBySlugPagePayload | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_BY_SLUG_QUERY,
        variables: { country, region, slug },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.routeBySlug) return null;
    return json.data.routeBySlug;
  } catch {
    return null;
  }
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)}` : `${km.toFixed(1)}`;
}

function formatElevation(meters: number): string {
  return `${Math.round(meters).toLocaleString()}`;
}

function formatDuration(meters: number): string {
  const hours = meters / 1000 / 60; // Rough: 60km/h avg motorcycle speed
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDifficulty(curvature: number | null | undefined): { label: string; color: string } {
  if (curvature == null) return { label: 'Unknown', color: palette.neutral400 };
  if (curvature >= 0.06) return { label: 'Expert', color: palette.danger500 };
  if (curvature >= 0.03) return { label: 'Intermediate', color: palette.warning500 };
  return { label: 'Easy', color: palette.success500 };
}

function getSurfaceLabel(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  switch (type) {
    case 'paved': return 'Paved';
    case 'mixed': return 'Mixed';
    case 'off-road': return 'Off-Road';
    default: return type;
  }
}

function prettifyRegion(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettifyCountry(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, country, region } = await params;
  const route = await fetchRoute(country, region, slug);
  if (!route) return { title: 'Route Not Found' };

  const title = route.name ?? 'Motorcycle Route';
  const description =
    route.editorialDescription ??
    route.description ??
    `${formatDistance(route.distanceM)} km motorcycle route in ${prettifyRegion(region)}, ${prettifyCountry(country)}`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
  };
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}) {
  const { slug, country, region } = await params;
  const route = await fetchRoute(country, region, slug);
  if (!route) notFound();

  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some((c) => c.name.includes('auth-token'));

  const difficulty = getDifficulty(route.curvatureIndex);
  const surfaceLabel = getSurfaceLabel(route.surfaceType);
  const routeName = route.name ?? 'Unnamed Route';
  const regionName = prettifyRegion(region);
  const countryName = prettifyCountry(country);
  const editorialText = route.editorialDescription ?? route.description;
  const decodedPolyline = route.polyline ? decodePolyline(route.polyline) : [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* ── Breadcrumb ── */}
      <nav className="border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 text-sm sm:px-6">
          <a href="/explore" className="text-neutral-400 hover:text-neutral-200 transition-colors">
            Explore
          </a>
          <span className="text-neutral-600">/</span>
          <a
            href={`/explore/${country}`}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {countryName}
          </a>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-300 truncate max-w-[200px]">{routeName}</span>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {/* Title + badges */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-[2.75rem]">
            {routeName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {route.isMotovaultPick && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: palette.signatureBgDark, color: palette.signature400 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Editor&apos;s Pick
              </span>
            )}
            {route.ratingAvg != null && route.ratingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill={palette.warning500} aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {route.ratingAvg.toFixed(1)}
                <span className="text-neutral-500">({route.ratingCount} {route.ratingCount === 1 ? 'review' : 'reviews'})</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: difficulty.color }}
              />
              <span className="text-neutral-300">{difficulty.label}</span>
            </span>
            <span className="text-sm text-neutral-400">·</span>
            <span className="text-sm text-neutral-300">{surfaceLabel}</span>
            <span className="text-sm text-neutral-400">·</span>
            <span className="text-sm text-neutral-400">{regionName}, {countryName}</span>
          </div>
        </div>

        {/* Map hero + action bar */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-neutral-800/60 bg-neutral-900">
          <RouteMapSection polyline={decodedPolyline} />
          {/* Action buttons — AllTrails-style top-right */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <GpxDownloadButton
              routeId={route.id}
              routeName={routeName}
              isAuthenticated={hasSession}
            />
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="border-y border-neutral-800/60 bg-neutral-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-neutral-800/60 px-4 py-6 sm:px-6 lg:grid-cols-3">
          <div className="text-center">
            <p className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
              {formatDistance(route.distanceM)}
              <span className="ml-1 text-base font-normal text-neutral-500">km</span>
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Length</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
              {route.elevationGainM != null ? formatElevation(route.elevationGainM) : '—'}
              {route.elevationGainM != null && (
                <span className="ml-1 text-base font-normal text-neutral-500">m</span>
              )}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Elevation gain</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl">
              {formatDuration(route.distanceM)}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-neutral-500">Est. time</p>
          </div>
        </div>
      </div>

      {/* ── Content Section ── */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Left column: description + ride tips */}
          <div className="lg:col-span-2 space-y-10">
            {/* Description */}
            {editorialText && (
              <section>
                <p className="text-base leading-relaxed text-neutral-300">
                  {editorialText}
                </p>
              </section>
            )}

            {/* Route Details card */}
            <section className="rounded-2xl border border-neutral-800/60 bg-neutral-900/50 p-6">
              <h2 className="mb-5 text-lg font-semibold text-neutral-100">Route Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800/60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={palette.neutral400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Surface</p>
                    <p className="text-sm font-medium text-neutral-200">{surfaceLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800/60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={palette.neutral400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Difficulty</p>
                    <p className="text-sm font-medium" style={{ color: difficulty.color }}>{difficulty.label}</p>
                  </div>
                </div>
                {route.curvatureIndex != null && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800/60">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={palette.neutral400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12c2-4 5-6 10-6s8 2 10 6c-2 4-5 6-10 6s-8-2-10-6z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Curvature</p>
                      <p className="text-sm font-medium text-neutral-200">
                        {route.curvatureIndex >= 0.06 ? 'Very Twisty' :
                         route.curvatureIndex >= 0.03 ? 'Twisty' :
                         route.curvatureIndex >= 0.015 ? 'Some Curves' : 'Mostly Straight'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800/60">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={palette.neutral400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Est. riding time</p>
                    <p className="text-sm font-medium text-neutral-200">{formatDuration(route.distanceM)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Contributor */}
            <section className="flex items-center gap-4 rounded-2xl border border-neutral-800/60 bg-neutral-900/50 p-5">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
                style={{ backgroundColor: palette.signature500, color: palette.white }}
              >
                {route.contributor.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-200">
                  Contributed by{' '}
                  {route.contributor.publicUsername ? (
                    <a
                      href={`/u/${route.contributor.publicUsername}`}
                      className="text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      {route.contributor.displayName}
                    </a>
                  ) : (
                    route.contributor.displayName
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  Added {new Date(route.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </section>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Reviews summary card */}
            {route.ratingAvg != null && route.ratingCount > 0 && (
              <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/50 p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  Riders are saying
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight text-neutral-50">
                    {route.ratingAvg.toFixed(1)}
                  </span>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill={palette.warning500} aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <p className="mt-2 text-sm text-neutral-400">
                  {route.ratingCount} {route.ratingCount === 1 ? 'review' : 'reviews'}
                  {route.commentCount > 0 && ` · ${route.commentCount} ${route.commentCount === 1 ? 'comment' : 'comments'}`}
                </p>
              </div>
            )}

            {/* Ride this route CTA */}
            <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/50 p-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Ride this route
              </h3>
              <p className="mb-4 text-sm text-neutral-400">
                Open in the MotoVault app for turn-by-turn navigation, live tracking, and fuel stops.
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://apps.apple.com/us/app/motovault/id6760291360"
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
                  style={{ backgroundColor: palette.signature500, color: palette.white }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Open in App
                </a>
              </div>
            </div>

            {/* Quick facts */}
            <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/50 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Quick facts
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Region</dt>
                  <dd className="text-neutral-200">{regionName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Country</dt>
                  <dd className="text-neutral-200">{countryName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Surface</dt>
                  <dd className="text-neutral-200">{surfaceLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Difficulty</dt>
                  <dd style={{ color: difficulty.color }}>{difficulty.label}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer back link ── */}
      <div className="border-t border-neutral-800/60 py-8 text-center">
        <a
          href="/explore"
          className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          ← Back to Explore
        </a>
      </div>
    </div>
  );
}
