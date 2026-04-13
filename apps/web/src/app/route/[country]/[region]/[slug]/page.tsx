import { palette } from '@motovault/design-system';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { GpxDownloadButton } from '@/components/gpx-download-button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const ROUTE_DETAIL_QUERY = `
  query RouteDetail($routeId: ID!) {
    routeDetail(routeId: $routeId) {
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

interface RouteData {
  id: string;
  name?: string | null;
  description?: string | null;
  distanceM: number;
  elevationGainM?: number | null;
  surfaceType?: string | null;
  curvatureIndex?: number | null;
  isMotovaultPick: boolean;
  editorialDescription?: string | null;
  ratingAvg?: number | null;
  ratingCount: number;
  commentCount: number;
  createdAt: string;
  contributor: {
    id: string;
    displayName: string;
    publicUsername?: string | null;
    avatarUrl?: string | null;
  };
}

/**
 * The slug is the route UUID for now. Once the routes table gains a
 * `slug` column, swap this to a slug-based lookup.
 */
async function fetchRoute(slug: string): Promise<RouteData | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_DETAIL_QUERY,
        variables: { routeId: slug },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.routeDetail) return null;
    return json.data.routeDetail;
  } catch {
    return null;
  }
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, country, region } = await params;
  const route = await fetchRoute(slug);
  if (!route) return { title: 'Route Not Found' };

  const title = route.name ?? 'Motorcycle Route';
  const description =
    route.editorialDescription ??
    route.description ??
    `${formatDistance(route.distanceM)} motorcycle route in ${region.replace(/-/g, ' ')}, ${country.replace(/-/g, ' ')}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
  };
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}) {
  const { slug } = await params;
  const route = await fetchRoute(slug);

  if (!route) {
    notFound();
  }

  // Check auth status from cookies (server-side)
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some((c) => c.name.includes('auth-token'));

  const surfaceLabel =
    route.surfaceType === 'paved'
      ? 'Paved'
      : route.surfaceType === 'mixed'
        ? 'Mixed'
        : route.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.neutral50 }}>
      {/* Header gradient */}
      <div
        className="h-32 w-full"
        style={{
          background: `linear-gradient(135deg, ${palette.gradientHeroStart}, ${palette.gradientHeroEnd})`,
        }}
      />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6" style={{ marginTop: '-3rem' }}>
        {/* Card */}
        <div
          className="rounded-2xl p-6 shadow-lg sm:p-8"
          style={{ backgroundColor: palette.white }}
        >
          {/* Title row */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {route.isMotovaultPick && (
                <span
                  className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: palette.signatureBgLight,
                    color: palette.signature500,
                  }}
                >
                  MotoVault Pick
                </span>
              )}
              <h1
                className="text-2xl font-bold sm:text-3xl"
                style={{ color: palette.neutral950 }}
              >
                {route.name ?? 'Unnamed Route'}
              </h1>
              <p className="mt-1 text-sm" style={{ color: palette.neutral500 }}>
                Shared by {route.contributor.displayName}
              </p>
            </div>

            <GpxDownloadButton
              routeId={route.id}
              routeName={route.name ?? 'MotoVault-Route'}
              isAuthenticated={hasSession}
            />
          </div>

          {/* Description */}
          {(route.editorialDescription || route.description) && (
            <p className="mb-6 text-sm leading-relaxed" style={{ color: palette.neutral700 }}>
              {route.editorialDescription ?? route.description}
            </p>
          )}

          {/* Stats grid */}
          <div
            className="mb-6 grid grid-cols-2 gap-4 rounded-xl p-4 sm:grid-cols-4"
            style={{ backgroundColor: palette.neutral100 }}
          >
            <div>
              <span className="text-xs font-medium" style={{ color: palette.neutral500 }}>
                Distance
              </span>
              <p className="text-lg font-bold" style={{ color: palette.neutral950 }}>
                {formatDistance(route.distanceM)}
              </p>
            </div>
            {route.elevationGainM != null && (
              <div>
                <span className="text-xs font-medium" style={{ color: palette.neutral500 }}>
                  Elevation
                </span>
                <p className="text-lg font-bold" style={{ color: palette.neutral950 }}>
                  {formatElevation(route.elevationGainM)}
                </p>
              </div>
            )}
            {surfaceLabel && (
              <div>
                <span className="text-xs font-medium" style={{ color: palette.neutral500 }}>
                  Surface
                </span>
                <p className="text-lg font-bold" style={{ color: palette.neutral950 }}>
                  {surfaceLabel}
                </p>
              </div>
            )}
            {route.ratingCount > 0 && route.ratingAvg != null && (
              <div>
                <span className="text-xs font-medium" style={{ color: palette.neutral500 }}>
                  Rating
                </span>
                <p className="text-lg font-bold" style={{ color: palette.neutral950 }}>
                  {route.ratingAvg.toFixed(1)} ({route.ratingCount})
                </p>
              </div>
            )}
          </div>

          {/* CTA */}
          <p className="text-center text-xs" style={{ color: palette.neutral400 }}>
            Open the route in the MotoVault app for turn-by-turn navigation
          </p>
        </div>
      </main>
    </div>
  );
}
