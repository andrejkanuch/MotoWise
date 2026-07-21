import type { RouteListItem } from '@motovault/types';
import Image from 'next/image';
import Link from 'next/link';
import { relativeTrip } from '@/lib/seo/canonical';

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
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
      return 'Unknown';
  }
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

function estimateTime(distanceM: number, surfaceType?: string | null): string {
  const avgSpeed = surfaceType === 'off-road' ? 25 : surfaceType === 'mixed' ? 40 : 60;
  const hours = distanceM / 1000 / avgSpeed;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Rich route card with Mapbox map thumbnail for index/listing pages.
 * Uses /api/route-hero/{id} for static map images (cached 7 days).
 */
export function RouteCard({ route }: { route: RouteListItem }) {
  const name = route.displayName ?? route.name ?? 'Unnamed Route';
  // Trip detail lives at the non-localized /trips/{country}/{region}/{slug} route.
  // There is no /explore/{country}/{region}/{slug} route — linking there 404s.
  // relativeTrip() lowercases ALL segments to match the trip page's self-canonical
  // (an uppercased segment would resolve to a duplicate URL). Use a plain next/link
  // (not the locale-aware Link) so /trips is never prefixed with a locale segment
  // (locale-prefixed /trips paths also 404).
  const href =
    route.countryCode && route.regionSlug && route.slug
      ? relativeTrip(route.countryCode, route.regionSlug, route.slug)
      : `/explore`;
  const diff = getDifficulty(route.curvatureIndex, route.elevationGainM);

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800/40 bg-neutral-900/40 transition-all duration-300 hover:border-neutral-700/60 hover:bg-neutral-900/60"
    >
      {/* Map thumbnail */}
      <div className="relative aspect-[5/3] w-full overflow-hidden">
        <Image
          src={`/api/route-hero/${route.id}`}
          alt={`Route map of ${name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-950/60 to-transparent" />

        {/* Twist score badge */}
        {route.curvatureIndex != null && route.curvatureIndex > 0 && (
          <span
            className={`absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur-sm ${twistColorClass(route.curvatureIndex)}`}
          >
            {twistLabel(route.curvatureIndex)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50 transition-colors group-hover:text-warm-400">
          {name}
        </h3>

        {/* Stats row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-400">
          <span className="flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {formatDistance(route.distanceM)}
          </span>

          {route.elevationGainM != null && (
            <span className="flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-3.5"
                aria-hidden="true"
              >
                <path d="M12 19V5m-5 5l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {formatElevation(route.elevationGainM)}
            </span>
          )}

          <span className="flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            {estimateTime(route.distanceM, route.surfaceType)}
          </span>
        </div>

        {/* Rating + difficulty */}
        <div className="mt-auto flex items-center gap-2.5 pt-3">
          {route.ratingAvg != null && route.ratingCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                {([0, 1, 2, 3, 4] as const).map((starIndex) => (
                  <svg
                    key={`${route.id}-star-${starIndex}`}
                    viewBox="0 0 20 20"
                    className={`size-3.5 ${
                      starIndex < Math.round(route.ratingAvg ?? 0)
                        ? 'fill-warm-400 text-warm-400'
                        : 'fill-neutral-700 text-neutral-700'
                    }`}
                    aria-hidden="true"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs text-neutral-400">{route.ratingAvg.toFixed(1)}</span>
            </div>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diff.colorClass}`}>
            {diff.label}
          </span>
          {route.surfaceType && route.surfaceType !== 'unknown' && (
            <span className="text-xs text-neutral-500">{surfaceLabel(route.surfaceType)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
