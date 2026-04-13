import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { palette } from '@motovault/design-system';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { fetchRouteBySlug } from '@/lib/fetch-route';

/**
 * Dynamic import of the interactive Mapbox map — only loaded for authenticated
 * users. This keeps the ~200KB mapbox-gl bundle out of the anonymous path.
 */
const MapHeroInteractive = dynamic(
  () => import('@/components/map-hero-interactive'),
  { ssr: false, loading: () => <MapSkeleton /> },
);

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ country: string; region: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country, region, slug } = await params;
  const route = await fetchRouteBySlug(country, region, slug);

  if (!route) {
    return { title: 'Route Not Found' };
  }

  const title = route.name ?? 'Motorcycle Route';
  const description = route.editorialDescription
    ?? route.description
    ?? `${formatDistance(route.distanceM)} motorcycle route`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://motovault.app/route/${country}/${region}/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function RouteDetailPage({ params }: PageProps) {
  const { country, region, slug } = await params;
  const route = await fetchRouteBySlug(country, region, slug);

  if (!route) {
    notFound();
  }

  // Check auth status server-side
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = !!session;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Map hero — interactive for auth users, static for anonymous */}
      {isAuthenticated ? (
        <MapHeroInteractive
          route={{
            id: route.id,
            name: route.name,
            polyline: route.polyline,
            distanceM: route.distanceM,
            elevationGainM: route.elevationGainM,
            surfaceType: route.surfaceType,
            curvatureIndex: route.curvatureIndex,
            ratingAvg: route.ratingAvg,
            ratingCount: route.ratingCount,
          }}
        />
      ) : (
        <StaticMapHero />
      )}

      {/* Route details */}
      <main id="route-details" className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Title & MotoVault Pick badge */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ color: palette.neutral900 }}>
              {route.name ?? 'Unnamed Route'}
            </h1>
            <p className="mt-1 text-sm capitalize" style={{ color: palette.neutral500 }}>
              {[region.replace(/-/g, ' '), country.toUpperCase()].join(', ')}
            </p>
          </div>
          {route.isMotovaultPick && (
            <span
              className="mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: palette.signatureBgLight,
                color: palette.signature500,
              }}
            >
              MotoVault Pick
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Distance" value={formatDistance(route.distanceM)} />
          {route.elevationGainM != null && (
            <StatCard label="Elevation Gain" value={`${Math.round(route.elevationGainM)} m`} />
          )}
          {route.surfaceType && (
            <StatCard label="Surface" value={capitalize(route.surfaceType)} />
          )}
          {route.curvatureIndex != null && (
            <StatCard label="Curvature" value={route.curvatureIndex.toFixed(1)} />
          )}
          {route.ratingAvg != null && (
            <StatCard
              label="Rating"
              value={`${route.ratingAvg.toFixed(1)} (${route.ratingCount})`}
            />
          )}
          <StatCard label="Comments" value={String(route.commentCount)} />
        </div>

        {/* Description */}
        {(route.editorialDescription ?? route.description) && (
          <section className="mt-8">
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: palette.neutral500 }}
            >
              About This Route
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-base" style={{ color: palette.neutral800 }}>
              {route.editorialDescription ?? route.description}
            </p>
          </section>
        )}

        {/* Contributor */}
        {route.contributor && (
          <section className="mt-8">
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: palette.neutral500 }}
            >
              Contributed by
            </h2>
            <div className="mt-3 flex items-center gap-3">
              {route.contributor.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: avatar from storage
                <img
                  src={route.contributor.avatarUrl}
                  alt={route.contributor.displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: palette.primary100, color: palette.primary600 }}
                >
                  {route.contributor.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: palette.neutral900 }}>
                  {route.contributor.displayName}
                </p>
                {route.contributor.publicUsername && (
                  <p className="text-xs" style={{ color: palette.neutral400 }}>
                    @{route.contributor.publicUsername}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Sign-in CTA for anonymous users */}
        {!isAuthenticated && (
          <section
            className="mt-8 rounded-xl p-6 text-center"
            style={{ backgroundColor: palette.primary50 }}
          >
            <p className="text-sm font-semibold" style={{ color: palette.primary700 }}>
              Sign in to explore the interactive map
            </p>
            <p className="mt-1 text-xs" style={{ color: palette.primary500 }}>
              Pan, zoom, rotate, and view the full route with start/end markers
            </p>
            <a
              href="/login"
              className="mt-4 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: palette.primary500, color: palette.white }}
            >
              Sign In
            </a>
          </section>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: palette.neutral200, backgroundColor: palette.white }}
    >
      <p className="text-xs" style={{ color: palette.neutral400 }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: palette.neutral900 }}>
        {value}
      </p>
    </div>
  );
}

function StaticMapHero() {
  return (
    <div
      className="flex h-[300px] w-full items-center justify-center sm:h-[400px]"
      style={{
        background: `linear-gradient(135deg, ${palette.gradientHeroStart}, ${palette.gradientHeroMid}, ${palette.gradientHeroEnd})`,
      }}
    >
      <div className="text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke={palette.primary200}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-3"
        >
          <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <p className="text-sm font-medium" style={{ color: palette.primary200 }}>
          Sign in to explore the interactive map
        </p>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div
      className="flex h-[300px] w-full animate-pulse items-center justify-center sm:h-[400px] md:h-[500px]"
      style={{ backgroundColor: palette.neutral200 }}
    >
      <p className="text-sm" style={{ color: palette.neutral400 }}>
        Loading map...
      </p>
    </div>
  );
}
