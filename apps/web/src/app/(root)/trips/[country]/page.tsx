import { palette } from '@motovault/design-system';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { isTargetMarket } from '@/lib/seo/market-indexing';
import '@/components/trip-detail/trip-detail.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? '';
// Waypoint pins are the rider's route on a map: the one place copper is a data
// mark (apps/mobile/DESIGN.md, "Ridden-route copper"). Mapbox wants bare hex.
const MAP_PIN_COLOR = palette.plateCopper.replace('#', '');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DISCOVER_TRIP_BY_ID_QUERY = `
  query DiscoverTripByIdRedirect($id: ID!) {
    discoverTripById(id: $id) {
      id slug countryCode regionCode
    }
  }
`;

const TRIP_DETAIL_FULL_QUERY = `
  query TripDetailFull($tripId: ID!) {
    tripDetail(tripId: $tripId) {
      id title description slug countryCode regionCode city
      distanceM elevationGainM dayCount difficulty surfaceType
      estimatedDurationMinutes averageRating reviewCount cloneCount
      isMotovaultPick isFeatured viewCount status visibility createdAt
      organiser { displayName publicUsername }
      waypoints { sortOrder dayIndex type name lat lng notes }
    }
  }
`;

interface TripData {
  id: string;
  title: string;
  description: string;
  slug: string | null;
  countryCode: string;
  regionCode?: string | null;
  city?: string | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  dayCount: number;
  difficulty: string;
  surfaceType?: string | null;
  estimatedDurationMinutes?: number | null;
  averageRating?: number | null;
  reviewCount: number;
  cloneCount: number;
  isMotovaultPick: boolean;
  viewCount: number;
  createdAt: string;
  organiser: { displayName: string; publicUsername?: string | null };
  waypoints: Array<{
    sortOrder: number;
    dayIndex: number;
    type: string;
    name: string;
    lat: number;
    lng: number;
    notes?: string | null;
  }>;
}

interface PageParams {
  params: Promise<{ country: string }>;
}

// cache() dedupes the generateMetadata + page-body lookups into one request.
const lookupTrip = cache(async (id: string): Promise<TripData | null> => {
  // Try discover trips — if it has a slug, we redirect
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: DISCOVER_TRIP_BY_ID_QUERY, variables: { id } }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    const trip = json?.data?.discoverTripById;
    if (trip?.slug && trip?.countryCode) {
      return { ...trip, _redirect: true } as TripData & { _redirect: boolean };
    }
  } catch {
    // fall through
  }

  // Full trip detail (user trips + templates without slug)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TRIP_DETAIL_FULL_QUERY, variables: { tripId: id } }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    const trip = json?.data?.tripDetail;
    if (trip?.countryCode) return trip;
  } catch {
    // fall through
  }

  return null;
});

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { country: id } = await params;
  if (!UUID_RE.test(id)) return {};
  const trip = await lookupTrip(id);
  // Slugged trips redirect to the canonical /trips/{country}/{region}/{slug}
  // page, which owns indexing. Only sluglass by-id trips render here — noindex
  // off-market geos (India etc.) so they never enter the index (mirrors the
  // canonical page); follow links so equity still flows.
  if (trip && !isTargetMarket(trip.countryCode)) {
    return { robots: { index: false, follow: true } };
  }
  return {};
}

// --- Helpers ---

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
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatDistance(meters: number): string {
  return Math.round(meters / 1000).toLocaleString('en-US');
}

function formatElevation(meters: number): string {
  return Math.round(meters).toLocaleString('en-US');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getMapboxStaticUrl(trip: TripData): string | null {
  if (!trip.waypoints.length || !MAPBOX_TOKEN) return null;
  const pins = trip.waypoints
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 20)
    .map((wp) => `pin-s+${MAP_PIN_COLOR}(${wp.lng},${wp.lat})`)
    .join(',');
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins}/auto/1200x675@2x?padding=60&access_token=${MAPBOX_TOKEN}`;
}

export default async function TripByIdPage({ params }: PageParams) {
  const { country: segment } = await params;

  if (!UUID_RE.test(segment)) {
    notFound();
  }

  const trip = await lookupTrip(segment);
  if (!trip) notFound();

  // If discover trip has a slug, redirect to canonical URL
  if (trip.slug) {
    const c = trip.countryCode.toLowerCase();
    const r = (trip.regionCode ?? 'general').toLowerCase();
    redirect(`/trips/${c}/${r}/${trip.slug}`);
  }

  // --- Render the full page for trips without slugs ---

  const countryName = countryDisplayName(trip.countryCode);
  const regionName = trip.regionCode ? regionDisplayName(trip.countryCode, trip.regionCode) : null;

  // Group waypoints by day
  const waypointsByDay = new Map<number, TripData['waypoints']>();
  for (const wp of trip.waypoints) {
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

  const distanceKm = trip.distanceM ? Math.round(trip.distanceM / 1000) : null;
  const elevationM = trip.elevationGainM ? Math.round(trip.elevationGainM) : null;
  const durationFormatted = trip.estimatedDurationMinutes
    ? formatDuration(trip.estimatedDurationMinutes)
    : null;
  const fuelStopCount = trip.waypoints.filter((wp) => wp.type === 'fuel').length;
  const surfaceLabel = trip.surfaceType ? capitalize(trip.surfaceType.replace(/_/g, ' ')) : null;
  const mapUrl = getMapboxStaticUrl(trip);
  const createdDate = new Date(trip.createdAt);
  const createdLabel = createdDate.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    year: 'numeric',
  });
  const hasRating = trip.averageRating != null && trip.reviewCount > 0;

  const sections: Array<{ id: string; label: string }> = [{ id: 'overview', label: 'Overview' }];
  if (trip.waypoints.length > 0) sections.push({ id: 'days', label: 'Day by day' });
  if (hasRating) sections.push({ id: 'reviews', label: 'Reviews' });

  return (
    <>
      {/* ══════════ HERO ══════════ */}
      <section className="rh">
        {mapUrl ? (
          <>
            <div className="rh-map-bg" style={{ backgroundImage: `url(${mapUrl})` }} />
            <div className="rh-scrim" aria-hidden="true" />
          </>
        ) : null}

        <div className="rh-inner">
          <nav aria-label="Breadcrumb">
            <ol className="mv-crumbs">
              <li>
                <a href="/explore">Explore</a>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <a href={`/explore/${trip.countryCode.toLowerCase()}`}>{countryName}</a>
              </li>
              {regionName && (
                <li>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span>{regionName}</span>
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
            {trip.dayCount > 0 && (
              <div className="rh-figure">
                <span className="mv-figure rh-figure-value">
                  {trip.dayCount}
                  <small>{trip.dayCount === 1 ? 'day' : 'days'}</small>
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
              slug={segment}
              className="mv-btn mv-btn-primary"
            >
              Get the app
            </StoreLink>
          </div>
          <p className="rh-author">
            Curated by <strong>{trip.organiser.displayName}</strong> · {createdLabel}
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
            {trip.waypoints.length > 0 && (
              <div className="mv-row">
                <dt>Waypoints</dt>
                <dd>{trip.waypoints.length}</dd>
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

      {/* ══════════ MAP ══════════ */}
      {mapUrl && (
        <section className="rsec">
          <div className="map-card">
            <div className="map-frame">
              {/* biome-ignore lint/performance/noImgElement: Mapbox static URL */}
              <img
                src={mapUrl}
                alt={`Map of the ${trip.title} route`}
                loading="lazy"
                width={1200}
                height={675}
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
              {trip.dayCount > 1
                ? `${trip.dayCount} days, stop by stop`
                : 'The route, stop by stop'}
            </h2>
          </div>

          <div className="itinerary">
            {days.map(({ dayIndex, waypoints }) => {
              const firstStop = waypoints[0];
              const lastStop = waypoints[waypoints.length - 1];
              const dayLabel =
                trip.dayCount > 1 ? `${firstStop?.name ?? ''} to ${lastStop?.name ?? ''}` : null;

              return (
                <div className="day" key={dayIndex}>
                  <div className="day-meta">
                    <div className="day-num">
                      {trip.dayCount > 1 ? `Day ${dayIndex + 1}` : 'Route'}
                    </div>
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
        </section>
      )}

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
            slug={segment}
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
    </>
  );
}
