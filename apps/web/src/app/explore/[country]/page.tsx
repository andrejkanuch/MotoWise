import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SaveRouteButton } from '@/components/save-route-button';
import { BASE_URL, getHreflangMap } from '@/lib/constants';
import {
  type ExploreRouteWithMap,
  fetchCountryBySlug,
  fetchExploreRoutesByCountry,
  fetchRegionsByCountrySlug,
} from '@/lib/fetch-places';
import { buildStaticMapUrl } from '@/lib/map/static-image-provider';

export const revalidate = 86400;

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ country: string }>;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

/** PostgREST / drivers may return `numeric` as string — never call `.toFixed` on a string. */
function ratingDisplay(avg: unknown, count: unknown): { text: string; stars: number } | null {
  const n = typeof avg === 'number' ? avg : Number(avg);
  const c = typeof count === 'number' ? count : Number(count);
  if (!Number.isFinite(n) || !Number.isFinite(c) || c <= 0) return null;
  return { text: n.toFixed(1), stars: Math.round(n) };
}

function formatElevation(meters: number): string {
  return `${Math.round(meters).toLocaleString()} m`;
}

function getDifficulty(
  curvature: number | null | undefined,
  elevation: number | null | undefined,
): { label: string; colorClass: string } {
  const ci = curvature ?? 0;
  const elev = elevation ?? 0;
  if (ci >= 0.06 || elev >= 2000)
    return { label: 'Expert', colorClass: 'bg-red-500/15 text-red-400' };
  if (ci >= 0.03 || elev >= 1000)
    return { label: 'Hard', colorClass: 'bg-orange-500/15 text-orange-400' };
  if (ci >= 0.015 || elev >= 500)
    return { label: 'Moderate', colorClass: 'bg-yellow-500/15 text-yellow-400' };
  return { label: 'Easy', colorClass: 'bg-green-500/15 text-green-400' };
}

function twistLabel(curvatureIndex: number): string {
  if (curvatureIndex >= 0.06) return 'Very Twisty';
  if (curvatureIndex >= 0.03) return 'Twisty';
  if (curvatureIndex >= 0.015) return 'Some Curves';
  return 'Straight';
}

function twistColorClass(curvatureIndex: number): string {
  if (curvatureIndex >= 0.06) return 'bg-accent-500/20 text-accent-400';
  if (curvatureIndex >= 0.03) return 'bg-primary-500/20 text-primary-400';
  return 'bg-neutral-700/40 text-neutral-400';
}

function surfaceLabel(surfaceType: string): string {
  switch (surfaceType) {
    case 'paved':
      return 'Paved';
    case 'mixed':
      return 'Mixed';
    case 'off-road':
      return 'Off-Road';
    default:
      return '';
  }
}

function estimateTime(distanceM: number, surfaceType?: string | null): string {
  const meters = Number(distanceM);
  if (!Number.isFinite(meters) || meters < 0) return '—';
  const avgSpeed = surfaceType === 'off-road' ? 25 : surfaceType === 'mixed' ? 40 : 60;
  const hours = meters / 1000 / avgSpeed;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function routeHref(route: {
  countryCode: string | null;
  regionSlug: string | null;
  slug: string | null;
  id: string;
}): string {
  return route.countryCode && route.regionSlug && route.slug
    ? `/route/${route.countryCode.toLowerCase()}/${route.regionSlug}/${route.slug}`
    : `/routes/${route.id}`;
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

/* ── Metadata ────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return {};

  const title = `Motorcycle Routes in ${country.name}`;
  const rc = country.routeCount;
  const description =
    rc > 0
      ? `Explore ${rc} motorcycle route${rc === 1 ? '' : 's'} in ${country.name}. Twisty roads, scenic passes, and rides rated by riders on MotoVault.`
      : `Motorcycle routes in ${country.name} are coming soon. Browse other countries on MotoVault or share a ride from the app.`;

  const canonical = `${BASE_URL}/explore/${countrySlug}`;
  const base: Metadata = {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: {
      canonical,
      languages: getHreflangMap(`/explore/${countrySlug}`),
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

/* ── Icon components ─────────────────────────────────────────── */

function DistanceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ElevationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M12 19V5m-5 5l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`size-3.5 ${filled ? 'fill-warm-400 text-warm-400' : 'fill-neutral-700 text-neutral-700'}`}
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4 shrink-0 text-neutral-600 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-400"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPlaceholder() {
  return (
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
  );
}

/* ── Route cards ─────────────────────────────────────────────── */

function RouteCardFeatured({ route, index }: { route: ExploreRouteWithMap; index: number }) {
  const diff = getDifficulty(route.curvatureIndex, route.elevationGainM);
  const mapUrl = route.polyline ? buildThumbnailUrl(route.polyline, 800, 400) : '';

  return (
    <a
      href={routeHref(route)}
      className="route-card group relative block overflow-hidden rounded-2xl border border-neutral-800/40 bg-neutral-900/50 transition-all duration-300 hover:border-neutral-700/60 hover:ring-1 hover:ring-neutral-700/30"
      style={{ animationDelay: `${Math.min(index * 80, 500)}ms` }}
    >
      {/* Map thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {mapUrl ? (
          <Image
            src={mapUrl}
            alt={`Route map of ${route.displayName ?? route.name ?? 'route'}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={index === 0}
          />
        ) : (
          <MapPlaceholder />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-950/20 to-transparent" />

        {/* Save button */}
        <span className="absolute right-3 top-3 z-10">
          <SaveRouteButton routeId={route.id} />
        </span>

        {/* Twist badge */}
        {route.curvatureIndex != null && route.curvatureIndex > 0 && (
          <span
            className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${twistColorClass(route.curvatureIndex)}`}
          >
            {twistLabel(route.curvatureIndex)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-neutral-50 transition-colors group-hover:text-warm-400">
          {route.displayName ?? route.name ?? 'Unnamed Route'}
        </h3>

        {route.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-neutral-400">{route.description}</p>
        )}

        {/* Stats */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-300">
          {route.distanceM > 0 && (
            <span className="flex items-center gap-1.5">
              <DistanceIcon />
              {formatDistance(route.distanceM)}
            </span>
          )}
          {route.elevationGainM != null && (
            <span className="flex items-center gap-1.5">
              <ElevationIcon />
              {formatElevation(route.elevationGainM)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <ClockIcon />
            Est. {estimateTime(route.distanceM, route.surfaceType)}
          </span>
          {route.surfaceType && route.surfaceType !== 'unknown' && (
            <span>{surfaceLabel(route.surfaceType)}</span>
          )}
        </div>

        {/* Rating + difficulty */}
        <div className="mt-3 flex items-center gap-3">
          {(() => {
            const r = ratingDisplay(route.ratingAvg, route.ratingCount);
            if (!r) return null;
            return (
              <div
                className="flex items-center gap-1.5"
                role="img"
                aria-label={`Rated ${r.text} out of 5 stars, ${route.ratingCount} reviews`}
              >
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {([0, 1, 2, 3, 4] as const).map((i) => (
                    <StarIcon key={`${route.id}-star-${i}`} filled={i < r.stars} />
                  ))}
                </div>
                <span className="text-sm text-neutral-300">
                  {r.text}
                  <span className="text-neutral-400"> ({route.ratingCount})</span>
                </span>
              </div>
            );
          })()}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${diff.colorClass}`}>
            {diff.label}
          </span>
        </div>
      </div>
    </a>
  );
}

function RouteCard({ route, index }: { route: ExploreRouteWithMap; index: number }) {
  const diff = getDifficulty(route.curvatureIndex, route.elevationGainM);
  const mapUrl = route.polyline ? buildThumbnailUrl(route.polyline, 400, 240) : '';

  return (
    <a
      href={routeHref(route)}
      className="route-card group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800/40 bg-neutral-900/40 transition-all duration-300 hover:border-neutral-700/60 hover:bg-neutral-900/60"
      style={{ animationDelay: `${Math.min(index * 80, 500)}ms` }}
    >
      {/* Map thumbnail */}
      <div className="relative aspect-[5/3] w-full overflow-hidden">
        {mapUrl ? (
          <Image
            src={mapUrl}
            alt={`Route map of ${route.displayName ?? route.name ?? 'route'}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <MapPlaceholder />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-950/60 to-transparent" />

        {/* Twist badge */}
        {route.curvatureIndex != null && route.curvatureIndex > 0 && (
          <span
            className={`absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur-sm ${twistColorClass(route.curvatureIndex)}`}
          >
            {twistLabel(route.curvatureIndex)}
          </span>
        )}

        {/* Save button */}
        <span className="absolute left-3 top-3 z-10">
          <SaveRouteButton routeId={route.id} />
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50 transition-colors group-hover:text-warm-400">
            {route.displayName ?? route.name ?? 'Unnamed Route'}
          </h3>
          <ChevronRight />
        </div>

        {/* Stats row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-300">
          {route.distanceM > 0 && (
            <span className="flex items-center gap-1">
              <DistanceIcon />
              {formatDistance(route.distanceM)}
            </span>
          )}
          {route.elevationGainM != null && (
            <span className="flex items-center gap-1">
              <ElevationIcon />
              {formatElevation(route.elevationGainM)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ClockIcon />
            {estimateTime(route.distanceM, route.surfaceType)}
          </span>
        </div>

        {/* Rating + difficulty */}
        <div className="mt-auto flex items-center gap-2.5 pt-3">
          {(() => {
            const r = ratingDisplay(route.ratingAvg, route.ratingCount);
            if (!r) return null;
            return (
              <div
                className="flex items-center gap-1"
                role="img"
                aria-label={`Rated ${r.text} out of 5`}
              >
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {([0, 1, 2, 3, 4] as const).map((i) => (
                    <StarIcon key={`${route.id}-star-${i}`} filled={i < r.stars} />
                  ))}
                </div>
                <span className="text-xs text-neutral-300">{r.text}</span>
              </div>
            );
          })()}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diff.colorClass}`}>
            {diff.label}
          </span>
          {route.surfaceType && route.surfaceType !== 'unknown' && (
            <span className="text-xs text-neutral-400">{surfaceLabel(route.surfaceType)}</span>
          )}
        </div>
      </div>
    </a>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default async function CountryPage({ params }: PageProps) {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  const [regions, topRoutes] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchExploreRoutesByCountry(country.countryCode, 12),
  ]);

  const featured = topRoutes[0] ?? null;
  const restRoutes = topRoutes.slice(1);

  return (
    <main className="min-h-screen text-neutral-50">
      {/* Stagger animation styles */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS keyframe animations for card entrance
        dangerouslySetInnerHTML={{
          __html: `
        .route-card {
          opacity: 0;
          transform: translateY(12px);
          animation: routeCardIn 0.4s ease-out forwards;
        }
        @keyframes routeCardIn {
          to { opacity: 1; transform: translateY(0); }
        }
        .region-pill {
          opacity: 0;
          animation: pillIn 0.3s ease-out forwards;
        }
        @keyframes pillIn {
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .route-card, .region-pill {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `,
        }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14 sm:pb-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-sm text-neutral-400"
        >
          <a href="/explore" className="transition-colors hover:text-neutral-200">
            Explore
          </a>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-3.5"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-neutral-300">{country.name}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
          Motorcycle Routes in {country.name}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-400">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-warm-500/15">
              <DistanceIcon />
            </span>
            <strong className="font-semibold text-neutral-200">{topRoutes.length}</strong> route
            {topRoutes.length !== 1 ? 's' : ''}
          </span>
          {regions.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-3.5"
                  aria-hidden="true"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <strong className="font-semibold text-neutral-200">{regions.length}</strong> region
              {regions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </section>

      {/* Region pills */}
      {regions.length > 0 && (
        <section
          aria-label={`Regions in ${country.name}`}
          className="mx-auto max-w-6xl px-4 pb-8 sm:px-6"
        >
          <h2 className="sr-only">Regions</h2>
          <div className="flex flex-wrap gap-2">
            {regions.map((region, i) => (
              <a
                key={region.id}
                href={`/explore/${countrySlug}/${region.slug}`}
                className="region-pill min-h-[44px] rounded-full border border-neutral-800/50 bg-neutral-900/30 px-4 py-2.5 text-sm text-neutral-300 transition-all hover:border-warm-500/40 hover:bg-neutral-900/60 hover:text-white"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                {region.name}
                {region.routeCount > 0 && (
                  <span className="ml-1.5 text-neutral-500">{region.routeCount}</span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Divider */}
      {topRoutes.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="h-px bg-neutral-800/40" />
        </div>
      )}

      {/* Routes */}
      {topRoutes.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xl font-bold text-neutral-50 sm:text-2xl">
              Top Routes in {country.name}
            </h2>
          </div>

          {/* Featured route — full width */}
          {featured && (
            <div className="mb-6">
              <RouteCardFeatured route={featured} index={0} />
            </div>
          )}

          {/* Route grid */}
          {restRoutes.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {restRoutes.map((route, i) => (
                <RouteCard key={route.id} route={route} index={i + 1} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {topRoutes.length === 0 && (
        <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900/50">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-8 text-neutral-600"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-300">No routes yet</h2>
          <p className="mt-2 text-neutral-500">
            Routes in {country.name} are coming soon. Share your favorite ride from the MotoVault
            app to be the first!
          </p>
          <a
            href="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-800/50 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            Browse other countries
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>
      )}
    </main>
  );
}
