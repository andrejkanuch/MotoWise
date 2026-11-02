import type { RouteListItem } from '@motovault/types';
import Image from 'next/image';
import Link from 'next/link';
import { relativeTrip } from '@/lib/seo/canonical';

function formatDistance(meters: number): { figure: string; unit: string } {
  const km = meters / 1000;
  return { figure: km >= 100 ? String(Math.round(km)) : km.toFixed(1), unit: 'km' };
}

function formatElevation(meters: number): { figure: string; unit: string } {
  return { figure: Math.round(meters).toLocaleString('en-US'), unit: 'm up' };
}

function twistLabel(curvatureIndex: number): string {
  if (curvatureIndex >= 0.06) return 'Very twisty';
  if (curvatureIndex >= 0.03) return 'Twisty';
  if (curvatureIndex >= 0.015) return 'Some curves';
  return 'Mostly straight';
}

const SURFACE_LABEL: Record<string, string> = {
  paved: 'Paved',
  mixed: 'Mixed surface',
  'off-road': 'Off-road',
};

function getDifficulty(
  curvature: number | null | undefined,
  elevation: number | null | undefined,
): string {
  const ci = curvature ?? 0;
  const elev = elevation ?? 0;
  if (ci >= 0.06 || elev >= 2000) return 'Expert';
  if (ci >= 0.03 || elev >= 1000) return 'Hard';
  if (ci >= 0.015 || elev >= 500) return 'Moderate';
  return 'Easy';
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
 * Route row for index/listing pages: the static map tile on the left
 * (`/api/route-hero/{id}`, cached 7 days), the name, then distance / climb /
 * time as condensed figures and the rest as body-face meta. Sits on the page
 * surface between hairlines (`.mv-route-row`); the list that renders it owns
 * the rows.
 */
export function RouteCard({ route }: { route: RouteListItem }) {
  const name = route.displayName ?? route.name ?? 'Unnamed route';
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
  const distance = formatDistance(route.distanceM);
  const elevation = route.elevationGainM != null ? formatElevation(route.elevationGainM) : null;
  const hasRating = route.ratingAvg != null && route.ratingCount > 0;
  const surface =
    route.surfaceType && route.surfaceType !== 'unknown' ? SURFACE_LABEL[route.surfaceType] : null;
  const twist =
    route.curvatureIndex != null && route.curvatureIndex > 0
      ? twistLabel(route.curvatureIndex)
      : null;

  return (
    <Link href={href} className="mv-route-row">
      <div className="mv-route-thumb">
        <Image
          src={`/api/route-hero/${route.id}`}
          alt={`Route map of ${name}`}
          fill
          sizes="132px"
          className="object-cover"
          loading="lazy"
        />
      </div>

      <div>
        <h3 className="mv-route-name">{name}</h3>

        <div className="mv-route-figures">
          <span>
            <span className="mv-figure">{distance.figure}</span>
            <span className="mv-route-unit">{distance.unit}</span>
          </span>
          {elevation && (
            <span>
              <span className="mv-figure">{elevation.figure}</span>
              <span className="mv-route-unit">{elevation.unit}</span>
            </span>
          )}
          <span>
            <span className="mv-figure">{estimateTime(route.distanceM, route.surfaceType)}</span>
          </span>
        </div>

        <div className="mv-route-meta">
          <span>{getDifficulty(route.curvatureIndex, route.elevationGainM)}</span>
          {twist && (
            <>
              <span aria-hidden="true">·</span>
              <span>{twist}</span>
            </>
          )}
          {surface && (
            <>
              <span aria-hidden="true">·</span>
              <span>{surface}</span>
            </>
          )}
          {hasRating && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                  aria-hidden="true"
                >
                  <path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 6 21l1.3-6.8-5-4.7 6.8-.8z" />
                </svg>
                <span className="mv-figure">{route.ratingAvg?.toFixed(1)}</span>
                <span>
                  ({route.ratingCount} {route.ratingCount === 1 ? 'rating' : 'ratings'})
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
