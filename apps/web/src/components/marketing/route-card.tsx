import { Link } from '@/i18n/navigation';
import type { RouteListItem } from '@/lib/fetch-places';

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

/**
 * Card displaying a route summary for index/listing pages.
 * Uses an image placeholder (colored gradient) since route thumbnails
 * are not yet part of the data model.
 */
export function RouteCard({ route }: { route: RouteListItem }) {
  const name = route.displayName ?? route.name ?? 'Unnamed Route';
  const href =
    route.countryCode && route.regionSlug && route.slug
      ? `/explore/${route.countryCode.toLowerCase()}/${route.regionSlug}/${route.slug}`
      : `/explore`;

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 backdrop-blur-sm transition-colors hover:border-warm-500/40"
    >
      {/* Image placeholder */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="size-12 text-neutral-700"
            aria-hidden="true"
          >
            <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Twist score badge */}
        {route.curvatureIndex != null && route.curvatureIndex > 0 && (
          <span
            className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-semibold ${twistColorClass(route.curvatureIndex)}`}
          >
            {twistLabel(route.curvatureIndex)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50 transition-colors group-hover:text-warm-400">
          {name}
        </h3>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
          {/* Distance */}
          <span className="flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
            {formatDistance(route.distanceM)}
          </span>

          {/* Elevation */}
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

          {/* Surface */}
          {route.surfaceType && route.surfaceType !== 'unknown' && (
            <span>{surfaceLabel(route.surfaceType)}</span>
          )}
        </div>

        {/* Rating */}
        {route.ratingAvg != null && route.ratingCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={`star-${route.id}-${i}`}
                  viewBox="0 0 20 20"
                  className={`size-3.5 ${
                    i < Math.round(route.ratingAvg ?? 0)
                      ? 'fill-warm-400 text-warm-400'
                      : 'fill-neutral-700 text-neutral-700'
                  }`}
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-neutral-400">
              {route.ratingAvg.toFixed(1)}{' '}
              <span className="text-neutral-500">({route.ratingCount})</span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
