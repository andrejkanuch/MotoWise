import {
  WebTripBySlugDocument,
  type WebTripBySlugQuery,
  WebTripReviewsDocument,
  type WebTripReviewsQuery,
} from '@motovault/graphql';
import { ArrowRight, ChevronRight, Star } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { GpxDownloadButton } from '@/components/gpx-download-button';
import { StoreLink } from '@/components/marketing/store-buttons';
import { SiblingRoutesSection } from '@/components/trip-detail/sibling-routes-section';
import { TripDetailMap } from '@/components/trip-detail/trip-detail-map';
import { BASE_URL } from '@/lib/constants';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import {
  fetchPublishedTripSlugRefs,
  fetchTripTemplatesByCountry,
  type TripTemplateNode,
} from '@/lib/fetch-places';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { gqlServerFetcher, isDefinitiveGraphQLError } from '@/lib/graphql-server';
import { relativeTrip } from '@/lib/seo/canonical';
import { isTargetMarket } from '@/lib/seo/market-indexing';
import { reportSoftNotFound } from '@/lib/seo/soft-404';
import { findBareSlugRedirect } from '@/lib/trips/bare-slug-redirect';
import { selectSiblingRoutes, siblingsAreRegionScoped } from '@/lib/trips/sibling-routes';
import '@/components/trip-detail/trip-detail.css';

type TripData = NonNullable<WebTripBySlugQuery['tripBySlug']>;

interface PageParams {
  params: Promise<{ country: string; region: string; slug: string }>;
}

type TripReview = WebTripReviewsQuery['tripReviews'][number];

// cache() dedupes the generateMetadata + page-body calls into one GraphQL request.
const fetchTrip = cache(
  async (country: string, region: string, slug: string): Promise<TripData | null> => {
    try {
      const data = await gqlServerFetcher(WebTripBySlugDocument, { country, region, slug });
      return data.tripBySlug ?? null;
    } catch (err) {
      // Only a definitive GraphQL "not found" (the resolver's NotFoundException,
      // surfaced as an errors array at HTTP 200) means the trip is truly absent →
      // null → notFound(). A transient/infra failure (timeout, 5xx, network) that
      // survived gqlServerFetcher's retries is NOT a 404: turning it into
      // notFound() emits a bogus soft-404 (Sentry MOTOVAULT-WEB-Q) and, under the
      // force-static ISR below, risks caching a 404 for a real trip. Re-throw so
      // Next renders an (uncached, retried) error instead of a false 404.
      if (!isDefinitiveGraphQLError(err)) throw err;
      return null;
    }
  },
);

// `null` = the reviews didn't load (presentation-only, so the page still renders);
// `[]` = the API answered and there are ratings but no written reviews.
async function fetchReviews(
  country: string,
  region: string,
  slug: string,
): Promise<TripReview[] | null> {
  try {
    const data = await gqlServerFetcher(WebTripReviewsDocument, {
      country,
      region,
      slug,
      first: 10,
    });
    return data.tripReviews ?? [];
  } catch {
    return null;
  }
}

/**
 * Sibling routes for internal linking: prefer same-region trips, fall back to
 * the rest of the country. Interlinks the published trip pages into a cluster
 * so link equity flows between them instead of each page being a dead end.
 */
async function fetchSiblingRoutes(
  country: string,
  region: string,
  currentSlug: string,
): Promise<TripTemplateNode[]> {
  try {
    const all = await fetchTripTemplatesByCountry(country, 24);
    return selectSiblingRoutes(all, region, currentSlug);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { country, region, slug } = await params;
  const trip = await fetchTrip(country, region, slug);
  if (!trip) return { title: 'Route not found' };

  const countryCode = trip.countryCode ?? country.toUpperCase();
  const countryName = countryDisplayName(countryCode);
  const regionName = trip.regionCode ? regionDisplayName(countryCode, trip.regionCode) : null;
  const dayCount = trip.dayCount ?? 1;
  const title = `${trip.title}: ${dayCount}-day motorcycle trip${regionName ? ` in ${regionName}` : ''}, ${countryName}`;
  const description = trip.description.slice(0, 155);
  // Lowercase canonical — the route is case-insensitive, so a page reached via an
  // uppercased path must still canonicalize to the single lowercase URL.
  const canonicalUrl = `${BASE_URL}${relativeTrip(country, region, slug)}`;

  return {
    title,
    description,
    // Off-market geos (India etc.) are noindexed but still followed, so link
    // equity flows to on-market pages without polluting the index (P4.1).
    ...(isTargetMarket(countryCode) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// Render statically (ISR) instead of dynamically — the dynamic root layout
// (getLocale/getMessages) would otherwise force this route dynamic and hit the
// origin on every request.
//
// `force-static` is NOT what caused the soft-404s, despite two earlier passes
// assuming it was. Measured in a local production build (see
// docs/plans/2026-08-05-001-fix-web-soft-404-rendering-strategy-plan.md, "U1
// RESULT"): the culprit was `app/loading.tsx`, which placed a Suspense boundary
// above every page, so the shell streamed before `notFound()` ran — and a
// streamed response can only carry a 200. Two builds differing only in that file
// flipped a bogus slug between 200 and 404. With the boundary gone this route
// keeps `force-static` and still returns a real 404, with
// `x-nextjs-prerender: 1` and `Cache-Control: s-maxage=86400` — the 404 is
// itself cached, which is correct.
//
// So no `generateStaticParams` / `dynamicParams = false` is needed: unknown slugs
// are generated on demand, `notFound()` produces a genuine 404, and a trip
// published after the last deploy is reachable without a rebuild.
//
// Do NOT add a loading.tsx above this route. It silently converts every 404 and
// every 308 on the subtree back into a 200 (Sentry MOTOVAULT-WEB-Q, 74 events),
// and dev mode cannot reproduce it — only a production build can.
export const dynamic = 'force-static';
export const revalidate = 86400; // 1 day — DB-sourced; invalidate on-demand on publish/edit

const WAYPOINT_LABELS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  fuel: 'Fuel stop',
  food: 'Restaurant',
  scenic: 'Scenic point',
  overnight: 'Overnight',
  photo: 'Photo spot',
  mechanical: 'Mechanical',
  ferry: 'Ferry',
  pass_summit: 'Mountain pass',
  rally_point: 'Rally point',
};

const WAYPOINT_ICONS: Record<string, React.ReactNode> = {
  start: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Start</title>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  end: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>End</title>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  fuel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Fuel</title>
      <path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17" />
      <path d="M15 10h2a2 2 0 012 2v3a2 2 0 002 2h0" />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Food</title>
      <path d="M3 8L21 8 21 19 3 19 3 8z" />
      <path d="M3 8L12 14 21 8" />
    </svg>
  ),
  scenic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Scenic</title>
      <path d="M3 18l4-8 5 6 4-4 5 6" />
      <circle cx="6" cy="7" r="2" />
    </svg>
  ),
  overnight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Overnight</title>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  photo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Photo</title>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  pass_summit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Pass</title>
      <path d="M3 18l4-8 5 6 4-4 5 6" />
    </svg>
  ),
  rally_point: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <title>Rally</title>
      <circle cx="12" cy="12" r="10" />
      <path d="M3 12L21 12" />
    </svg>
  ),
};

function getWaypointIcon(type: string): React.ReactNode {
  return (
    WAYPOINT_ICONS[type] ?? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <title>Waypoint</title>
        <circle cx="12" cy="12" r="10" />
      </svg>
    )
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatDistance(meters: number): string {
  const km = Math.round(meters / 1000);
  return km.toLocaleString('en-US');
}

function formatElevation(meters: number): string {
  return Math.round(meters).toLocaleString('en-US');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function buildSections(trip: TripData) {
  const sections: Array<{ id: string; label: string }> = [{ id: 'overview', label: 'Overview' }];
  if ((trip.waypoints ?? []).length > 0) sections.push({ id: 'days', label: 'Day by day' });
  if (trip.averageRating != null && trip.reviewCount > 0) {
    sections.push({ id: 'reviews', label: 'Reviews' });
  }
  return sections;
}

export default async function TripPage({ params }: PageParams) {
  const { country, region, slug } = await params;
  const [trip, reviews, siblingRoutes] = await Promise.all([
    fetchTrip(country, region, slug),
    fetchReviews(country, region, slug),
    fetchSiblingRoutes(country, region, slug),
  ]);
  if (!trip) {
    // Bare-slug recovery, restored now that in-page redirects work again.
    // ~28 trips carry an 8-hex dedup suffix (`furka-pass-6625deaf`); old links and
    // hand-typed URLs hit the bare form, which has no row. 301 those to the
    // canonical slug when the match is unambiguous, rather than serving the same
    // trip at two URLs. Verified in a production build: `permanentRedirect()` here
    // emits a real HTTP 308 (with `x-nextjs-prerender: 1`) under this route's
    // `force-static`. It used to bake a 200 "Trip Not Found" — because of the
    // streaming boundary above the page (`app/loading.tsx`, now deleted), NOT
    // because of `force-static`, which is what PR #177's removal assumed.
    //
    // Swallow a failure of the ref fetch: the trip is already known to be
    // definitively absent, so the only loss is a possible 308 on one of ~28 URLs
    // and the cached 404 self-heals on the next revalidation. Re-throwing would
    // turn an API blip into a 500 on the far more common genuinely-bogus slug.
    const canonicalSlug = findBareSlugRedirect(
      await fetchPublishedTripSlugRefs().catch(() => []),
      country,
      region,
      slug,
    );
    if (canonicalSlug) permanentRedirect(relativeTrip(country, region, canonicalSlug));

    // Otherwise a URL with no trip: unknown slug, or one unpublished since it was
    // last rendered. `notFound()` emits a real 404 here — see the route config
    // above for why. `fetchTrip` only returns null on a DEFINITIVE not-found; a
    // transient API failure re-throws, so an infra blip can never bake a cached
    // 404 over a real trip.
    //
    // Renamed slugs (not merely hash-suffixed) 308 from LEGACY_TRIP_REDIRECTS in
    // next.config.ts, which runs before rendering and costs no GraphQL call.
    reportSoftNotFound('trip-detail', { country, region, slug });
    notFound();
  }

  const countryCode = trip.countryCode ?? country.toUpperCase();
  const dayCount = trip.dayCount ?? 1;
  const countryName = countryDisplayName(countryCode);
  const regionName = trip.regionCode ? regionDisplayName(countryCode, trip.regionCode) : null;
  // Label the "More routes" cluster by region only when every sibling is actually
  // in this region; selectSiblingRoutes falls back to country-wide when the region
  // has < 3 siblings, and a region heading over country-wide cards is misleading.
  const siblingScope = siblingsAreRegionScoped(siblingRoutes, region)
    ? (regionName ?? countryName)
    : countryName;

  // Group waypoints by day
  const waypoints = trip.waypoints ?? [];
  const waypointsByDay = new Map<number, typeof waypoints>();
  for (const wp of waypoints) {
    const day = waypointsByDay.get(wp.dayIndex) ?? [];
    day.push(wp);
    waypointsByDay.set(wp.dayIndex, day);
  }
  const days = [...waypointsByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, waypoints]) => ({
      dayIndex,
      waypoints: waypoints.sort((a, b) => a.sortOrder - b.sortOrder),
    }));

  // Compute stats
  const distanceKm = trip.distanceM ? Math.round(trip.distanceM / 1000) : null;
  const elevationM = trip.elevationGainM ? Math.round(trip.elevationGainM) : null;
  const durationFormatted = trip.estimatedDurationMinutes
    ? formatDuration(trip.estimatedDurationMinutes)
    : null;
  const fuelStopCount = waypoints.filter((wp) => wp.type === 'fuel').length;
  const surfaceLabel = trip.surfaceType ? capitalize(trip.surfaceType.replace(/_/g, ' ')) : null;
  const sections = buildSections(trip);
  const updatedDate = new Date(trip.updatedAt ?? trip.createdAt);
  const updatedLabel = updatedDate.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    year: 'numeric',
  });

  // JSON-LD structured data (TouristTrip)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: trip.description,
    touristType: 'Motorcycle touring',
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: waypoints.length,
      itemListElement: waypoints.map((wp, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'TouristAttraction',
          name: wp.name,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: wp.lat,
            longitude: wp.lng,
          },
        },
      })),
    },
    ...(trip.averageRating != null && trip.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: trip.averageRating,
            reviewCount: trip.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: `${BASE_URL}/explore` },
      {
        '@type': 'ListItem',
        position: 2,
        name: countryName,
        item: `${BASE_URL}/explore/${country}`,
      },
      ...(regionName
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: regionName,
              item: `${BASE_URL}/explore/${country}/${region}`,
            },
          ]
        : []),
      { '@type': 'ListItem', position: regionName ? 4 : 3, name: trip.title },
    ],
  };

  const hasRating = trip.averageRating != null && trip.reviewCount > 0;
  const reviewsLabel = trip.reviewCount === 1 ? 'review' : 'reviews';

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ══════════ HERO ══════════ */}
      <section className="rh">
        <div className="rh-inner">
          <nav aria-label="Breadcrumb">
            <ol className="mv-crumbs">
              <li>
                <a href="/explore">Explore</a>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <a href={`/explore/${country}`}>{countryName}</a>
              </li>
              {regionName && (
                <li>
                  <ChevronRight size={14} aria-hidden="true" />
                  <a href={`/explore/${country}/${region}`}>{regionName}</a>
                </li>
              )}
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">{trip.title}</span>
              </li>
            </ol>
          </nav>

          <h1 className="mv-section-title rh-title">{trip.title}</h1>

          <p className="rh-context">
            <span>
              {trip.city ? `${trip.city}, ` : ''}
              {countryName}
            </span>
            {trip.isMotovaultPick && <span className="rh-pick">Editor's pick</span>}
          </p>

          <div className="rh-figures">
            {distanceKm != null && (
              <div className="rh-figure">
                <span className="mv-figure rh-figure-value">
                  {formatDistance(trip.distanceM ?? 0)}
                  <small>km</small>
                </span>
                <span className="rh-figure-label">Distance</span>
              </div>
            )}
            {dayCount > 0 && (
              <div className="rh-figure">
                <span className="mv-figure rh-figure-value">
                  {dayCount}
                  <small>{dayCount === 1 ? 'day' : 'days'}</small>
                </span>
                <span className="rh-figure-label">On the road</span>
              </div>
            )}
            {durationFormatted && (
              <div className="rh-figure">
                <span className="mv-figure rh-figure-value">{durationFormatted}</span>
                <span className="rh-figure-label">Riding time</span>
              </div>
            )}
            {elevationM != null && elevationM > 0 && (
              <div className="rh-figure">
                <span className="mv-figure rh-figure-value">
                  {formatElevation(trip.elevationGainM ?? 0)}
                  <small>m</small>
                </span>
                <span className="rh-figure-label">Climb</span>
              </div>
            )}
            {hasRating && (
              <div className="rh-figure">
                <span className="mv-figure rh-figure-value">
                  {trip.averageRating?.toFixed(1)}
                  <small>/ 5</small>
                </span>
                <span className="rh-figure-label">
                  {trip.reviewCount} {trip.reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            )}
          </div>

          <div className="rh-actions">
            <StoreLink
              platform={StorePlatform.Unknown}
              pageType={CtaPageType.Trip}
              placement={CtaPlacement.Hero}
              slug={slug}
              className="mv-btn mv-btn-primary"
            >
              Get the app
            </StoreLink>
            <GpxDownloadButton
              country={country}
              region={region}
              slug={slug}
              routeName={trip.title}
            />
          </div>
          <p className="rh-author">
            Curated by <strong>{trip.organiser.displayName}</strong> · Updated {updatedLabel}
          </p>
        </div>
      </section>

      {/* ══════════ IN-PAGE NAV ══════════ */}
      <nav className="tabnav" aria-label="On this page">
        <div className="tabnav-inner mv-scroll-row">
          {sections.map((sec) => (
            <a key={sec.id} className="tabnav-tab" href={`#${sec.id}`}>
              {sec.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ══════════ OVERVIEW ══════════ */}
      <section className="rsec rsec--lead" id="overview">
        <div className="rsec-head">
          <h2 className="mv-h2">About the route</h2>
        </div>

        <div className="overview-grid">
          <div className="overview-text">
            {trip.description.split('\n\n').length > 1 ? (
              trip.description.split('\n\n').map((para) => <p key={para.slice(0, 32)}>{para}</p>)
            ) : (
              <p>{trip.description}</p>
            )}
          </div>

          <dl className="mv-rows rfacts">
            <div className="mv-row">
              <dt>Difficulty</dt>
              <dd>{capitalize(trip.difficulty)}</dd>
            </div>
            {surfaceLabel && (
              <div className="mv-row">
                <dt>Surface</dt>
                <dd>{surfaceLabel}</dd>
              </div>
            )}
            {waypoints.length > 0 && (
              <div className="mv-row">
                <dt>Waypoints</dt>
                <dd>{waypoints.length}</dd>
              </div>
            )}
            {fuelStopCount > 0 && (
              <div className="mv-row">
                <dt>Fuel stops</dt>
                <dd>{fuelStopCount}</dd>
              </div>
            )}
            {trip.cloneCount > 0 && (
              <div className="mv-row">
                <dt>Saved by riders</dt>
                <dd>{trip.cloneCount.toLocaleString('en-US')}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* ══════════ INTERACTIVE MAP ══════════ */}
      {waypoints.length > 0 && (
        <section className="rsec">
          <div className="map-card">
            <div className="map-frame" style={{ height: 500 }}>
              <TripDetailMap
                waypoints={waypoints.map((wp) => ({
                  lat: wp.lat,
                  lng: wp.lng,
                  name: wp.name,
                  type: wp.type,
                  dayIndex: wp.dayIndex,
                  sortOrder: wp.sortOrder,
                  notes: wp.notes,
                }))}
                polyline={trip.polyline}
              />
            </div>
          </div>
        </section>
      )}

      {/* ══════════ DAY BY DAY ══════════ */}
      {days.length > 0 && (
        <section className="rsec rsec--itinerary mv-reveal" id="days">
          <div className="rsec-head">
            <h2 className="mv-h2">
              {dayCount > 1 ? `${dayCount} days, stop by stop` : 'The route, stop by stop'}
            </h2>
          </div>

          <div className="itinerary">
            {days.map(({ dayIndex, waypoints }) => {
              const firstStop = waypoints[0];
              const lastStop = waypoints[waypoints.length - 1];
              const dayLabel =
                dayCount > 1 ? `${firstStop?.name ?? ''} to ${lastStop?.name ?? ''}` : null;

              return (
                <div className="day" key={dayIndex}>
                  <div className="day-meta">
                    <div className="day-num">{dayCount > 1 ? `Day ${dayIndex + 1}` : 'Route'}</div>
                    {dayLabel && <div className="day-route">{dayLabel}</div>}
                    <div className="day-stats">
                      <span className="mv-figure">{waypoints.length}</span>{' '}
                      {waypoints.length === 1 ? 'stop' : 'stops'}
                    </div>
                  </div>
                  <div className="day-stops">
                    {waypoints.map((wp) => (
                      <div className="stop" key={`${dayIndex}-${wp.sortOrder}-${wp.name}`}>
                        <div className="stop-icon">{getWaypointIcon(wp.type)}</div>
                        <div className="stop-name">
                          {wp.name}
                          <small>
                            {WAYPOINT_LABELS[wp.type] ?? capitalize(wp.type.replace(/_/g, ' '))}
                            {wp.notes ? ` · ${wp.notes}` : ''}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════ REVIEWS ══════════ */}
      {hasRating && (
        <section className="rsec rsec--reviews" id="reviews">
          <div className="rsec-head">
            <h2 className="mv-h2">From riders who rode it</h2>
          </div>

          <div className="reviews-score">
            <span className="mv-figure reviews-score-num">{trip.averageRating?.toFixed(1)}</span>
            <span className="reviews-score-out">/5</span>
          </div>
          <StarRow rating={Math.round(trip.averageRating ?? 0)} idPrefix="summary" />

          {reviews === null && (
            <p className="reviews-note" role="status">
              Reviews didn&apos;t load. Reload the page to try again.
            </p>
          )}
          {reviews?.length === 0 && (
            <p className="reviews-note">
              {trip.reviewCount} {reviewsLabel} as ratings only; written reviews appear here.
            </p>
          )}

          {reviews && reviews.length > 0 && (
            <ul className="mv-rows review-list">
              {reviews.map((review) => {
                const authorName = review.author?.displayName ?? 'Anonymous';
                const initials = getInitials(authorName);
                const reviewDate = new Date(review.createdAt).toLocaleDateString('en-US', {
                  timeZone: 'UTC',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <li key={review.id}>
                    <article className="review">
                      <div className="review-head">
                        <div className="review-avatar" aria-hidden="true">
                          {initials}
                        </div>
                        <div className="review-who">
                          <div className="review-author">{authorName}</div>
                          <div className="review-meta">
                            {review.bike && (
                              <span>
                                {review.bike.year} {review.bike.make} {review.bike.model}
                              </span>
                            )}
                            <span>{reviewDate}</span>
                          </div>
                        </div>
                        <StarRow rating={review.rating} idPrefix={review.id} />
                      </div>

                      {review.text && <p className="review-text">{review.text}</p>}

                      {review.conditionTags && review.conditionTags.length > 0 && (
                        <p className="review-tags">
                          Conditions:{' '}
                          {review.conditionTags.map((tag) => tag.replace(/_/g, ' ')).join(', ')}
                        </p>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ══════════ MORE ROUTES (internal-link cluster) ══════════ */}
      <SiblingRoutesSection
        routes={siblingRoutes}
        scopeLabel={siblingScope}
        fallbackCountryCode={countryCode}
      />

      {/* ══════════ END CTA ══════════ */}
      <section className="end-cta">
        <h2 className="mv-h2 end-cta-title">Save this route to your phone</h2>
        <p className="end-cta-sub">
          Copy it into your trip planner, change the dates and stops, then ride it. Free.
        </p>
        <div className="end-cta-actions">
          <StoreLink
            platform={StorePlatform.Unknown}
            pageType={CtaPageType.Trip}
            placement={CtaPlacement.EndArticle}
            slug={slug}
            className="mv-btn mv-btn-primary"
          >
            Get the app
            <ArrowRight size={16} aria-hidden="true" />
          </StoreLink>
          <a href="/explore" className="mv-btn mv-btn-ghost">
            More routes
          </a>
        </div>
      </section>

      {/* ══════════ STICKY PHONE CTA ══════════ */}
      <div className="trip-sticky-spacer" aria-hidden="true" />
      <div className="trip-sticky mv-enter-up">
        <div className="trip-sticky-body">
          <div className="trip-sticky-title">{trip.title}</div>
          <div className="trip-sticky-sub">Copy it into your planner and record the ride</div>
        </div>
        <StoreLink
          platform={StorePlatform.Unknown}
          pageType={CtaPageType.Trip}
          placement={CtaPlacement.StickyBar}
          slug={slug}
          className="mv-btn mv-btn-primary"
        >
          Get the app
        </StoreLink>
      </div>
    </>
  );
}

/** Five drawn stars (Lucide), filled up to the rating; ink, never copper or signal. */
function StarRow({ rating, idPrefix }: { rating: number; idPrefix: string }) {
  return (
    <span className="reviews-stars" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={`${idPrefix}-star-${star}`}
          size={16}
          aria-hidden="true"
          fill={star <= rating ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}
