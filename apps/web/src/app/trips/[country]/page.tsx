import { notFound, redirect } from 'next/navigation';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import '@/components/trip-detail/trip-detail.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? '';

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

async function lookupTrip(id: string): Promise<TripData | null> {
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
}

// --- Helpers ---

const WAYPOINT_LABELS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  fuel: 'Fuel Stop',
  food: 'Restaurant',
  scenic: 'Scenic Point',
  overnight: 'Overnight',
  photo: 'Photo Spot',
  mechanical: 'Mechanical',
  ferry: 'Ferry',
  pass_summit: 'Mountain Pass',
  rally_point: 'Rally Point',
};

const WAYPOINT_ICONS: Record<string, React.ReactNode> = {
  start: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Start</title>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  end: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>End</title>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  fuel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Fuel</title>
      <path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17" />
      <path d="M15 10h2a2 2 0 012 2v3a2 2 0 002 2h0" />
    </svg>
  ),
  scenic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Scenic</title>
      <path d="M3 18l4-8 5 6 4-4 5 6" />
      <circle cx="6" cy="7" r="2" />
    </svg>
  ),
  overnight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Overnight</title>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  photo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Photo</title>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  pass_summit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Pass</title>
      <path d="M3 18l4-8 5 6 4-4 5 6" />
    </svg>
  ),
};

function getWaypointIcon(type: string): React.ReactNode {
  return (
    WAYPOINT_ICONS[type] ?? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  return Math.round(meters / 1000).toLocaleString();
}

function formatElevation(meters: number): string {
  return Math.round(meters).toLocaleString();
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

function getMapboxStaticUrl(trip: TripData): string | null {
  if (!trip.waypoints.length || !MAPBOX_TOKEN) return null;
  const pins = trip.waypoints
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 20)
    .map((wp) => `pin-s+d4a243(${wp.lng},${wp.lat})`)
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

  // --- Render the full redesigned page for trips without slugs ---

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
  const createdLabel = createdDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const titleWords = trip.title.split(' ');
  const lastWord = titleWords.pop() ?? '';
  const firstLine = titleWords.join(' ');

  const sections: Array<{ id: string; label: string; num: string }> = [];
  let idx = 1;
  sections.push({ id: 'overview', label: 'Overview', num: `/${String(idx++).padStart(2, '0')}` });
  if (trip.waypoints.length > 0) {
    sections.push({ id: 'days', label: 'Day-by-day', num: `/${String(idx++).padStart(2, '0')}` });
  }
  if (trip.averageRating != null && trip.reviewCount > 0) {
    sections.push({ id: 'reviews', label: 'Reviews', num: `/${String(idx++).padStart(2, '0')}` });
  }

  return (
    <>
      {/* ══════════ HERO ══════════ */}
      <section className="rh">
        {mapUrl ? (
          <div className="rh-map-bg" style={{ backgroundImage: `url(${mapUrl})` }} />
        ) : null}
        <div className="rh-overlay" />
        <div className="rh-grid" />

        <div className="rh-top">
          <div className="rh-crumb">
            <a href="/explore">Explore</a>
            <span className="rh-crumb-sep">/</span>
            <a href={`/explore/${trip.countryCode.toLowerCase()}`}>{countryName}</a>
            {regionName && (
              <>
                <span className="rh-crumb-sep">/</span>
                <span>{regionName}</span>
              </>
            )}
            <span className="rh-crumb-sep">/</span>
            <span className="current">{trip.title}</span>
          </div>

          <div className="rh-meta-row">
            <span className="rh-tag">
              <span className="rh-tag-flag">{trip.countryCode.toUpperCase()}</span>
              {trip.city ? `${trip.city}, ` : ''}
              {countryName}
            </span>
            <span className="rh-tag">
              <span className="rh-tag-dot" />
              {capitalize(trip.difficulty)}
            </span>
            {surfaceLabel && <span className="rh-tag">{surfaceLabel}</span>}
            {trip.dayCount > 1 && <span className="rh-tag">{trip.dayCount}-day trip</span>}
            {trip.isMotovaultPick && <span className="rh-tag">MotoVault Pick</span>}
          </div>

          <h1 className="rh-title">
            {firstLine && (
              <span className="rh-title-line">
                <span>{firstLine}</span>
              </span>
            )}
            <span className="rh-title-line">
              <span>
                <em className="serif">{lastWord}.</em>
              </span>
            </span>
          </h1>
        </div>

        <div className="rh-bottom">
          <div className="rh-stats">
            {distanceKm != null && (
              <div className="rh-stat">
                <div className="rh-stat-label">Distance</div>
                <div className="rh-stat-value">
                  {formatDistance(trip.distanceM ?? 0)} <span className="serif">km</span>
                </div>
              </div>
            )}
            {trip.dayCount > 0 && (
              <div className="rh-stat">
                <div className="rh-stat-label">Duration</div>
                <div className="rh-stat-value">
                  {trip.dayCount}{' '}
                  <span className="serif">{trip.dayCount === 1 ? 'day' : 'days'}</span>
                </div>
                {durationFormatted && (
                  <div className="rh-stat-sub">~{durationFormatted} riding</div>
                )}
              </div>
            )}
            {elevationM != null && elevationM > 0 && (
              <div className="rh-stat">
                <div className="rh-stat-label">Climb</div>
                <div className="rh-stat-value">
                  {formatElevation(trip.elevationGainM ?? 0)} <span className="serif">m</span>
                </div>
              </div>
            )}
            {trip.averageRating != null && trip.reviewCount > 0 && (
              <div className="rh-stat">
                <div className="rh-stat-label">Rating</div>
                <div className="rh-stat-value">
                  {trip.averageRating.toFixed(1)} <span className="serif">/ 5</span>
                </div>
                <div className="rh-stat-sub">
                  {trip.reviewCount} {trip.reviewCount === 1 ? 'review' : 'reviews'}
                </div>
              </div>
            )}
          </div>

          <div className="rh-actions">
            <div className="rh-cta-row">
              <a
                className="rh-icon-btn"
                href="https://apps.apple.com/us/app/motovault-motorcycle-garage/id6760291360"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <title>Clone</title>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Clone in App
              </a>
            </div>
            <div className="rh-author">
              <div className="rh-author-avatar">{getInitials(trip.organiser.displayName)}</div>
              Curated by <strong>{trip.organiser.displayName}</strong> · {createdLabel}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TAB NAV ══════════ */}
      <nav className="tabnav">
        <div className="tabnav-inner">
          {sections.map((sec) => (
            <a key={sec.id} className="tabnav-tab" href={`#${sec.id}`}>
              {sec.label} <span className="num">{sec.num}</span>
            </a>
          ))}
          <a
            className="tabnav-cta"
            href="https://apps.apple.com/us/app/motovault-motorcycle-garage/id6760291360"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in app &rarr;
          </a>
        </div>
      </nav>

      {/* ══════════ OVERVIEW ══════════ */}
      <section className="rsec" id="overview">
        <div className="rsec-head">
          <div>
            <div className="rsec-meta">Overview</div>
            <h2 className="rsec-title">
              {trip.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className="serif">{trip.title.split(' ').pop()}.</span>
            </h2>
          </div>
        </div>

        <div className="overview-grid">
          <div className="overview-text">
            {trip.description.split('\n\n').length > 1 ? (
              trip.description.split('\n\n').map((para) => <p key={para.slice(0, 32)}>{para}</p>)
            ) : (
              <p>{trip.description}</p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="factbox">
              <h4>Quick facts</h4>
              {surfaceLabel && (
                <div className="factbox-row">
                  <span className="factbox-key">Surface</span>
                  <span className="factbox-val">{surfaceLabel}</span>
                </div>
              )}
              {distanceKm != null && (
                <div className="factbox-row">
                  <span className="factbox-key">Distance</span>
                  <span className="factbox-val">{formatDistance(trip.distanceM ?? 0)} km</span>
                </div>
              )}
              {trip.dayCount > 0 && (
                <div className="factbox-row">
                  <span className="factbox-key">Days</span>
                  <span className="factbox-val">{trip.dayCount}</span>
                </div>
              )}
              {elevationM != null && elevationM > 0 && (
                <div className="factbox-row">
                  <span className="factbox-key">Total climb</span>
                  <span className="factbox-val">{formatElevation(trip.elevationGainM ?? 0)} m</span>
                </div>
              )}
              {fuelStopCount > 0 && (
                <div className="factbox-row">
                  <span className="factbox-key">Fuel stops</span>
                  <span className="factbox-val">{fuelStopCount} along route</span>
                </div>
              )}
              {durationFormatted && (
                <div className="factbox-row">
                  <span className="factbox-key">Est. riding time</span>
                  <span className="factbox-val">{durationFormatted}</span>
                </div>
              )}
              <div className="factbox-row">
                <span className="factbox-key">Difficulty</span>
                <span className="factbox-val">{capitalize(trip.difficulty)}</span>
              </div>
              {trip.cloneCount > 0 && (
                <div className="factbox-row">
                  <span className="factbox-key">Clones</span>
                  <span className="factbox-val warm">{trip.cloneCount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ MAP ══════════ */}
      {mapUrl && (
        <section className="rsec" style={{ paddingTop: 0 }}>
          <div className="map-card">
            <div className="map-frame">
              {/* biome-ignore lint/performance/noImgElement: Mapbox static URL */}
              <img
                src={mapUrl}
                alt={`Map of ${trip.title} route`}
                loading="lazy"
                width={1200}
                height={675}
              />
            </div>
          </div>
        </section>
      )}

      {/* ══════════ DAY-BY-DAY ══════════ */}
      {days.length > 0 && (
        <section className="rsec" id="days">
          <div className="rsec-head">
            <div>
              <div className="rsec-meta">Day-by-day</div>
              <h2 className="rsec-title">
                {trip.dayCount > 1 ? (
                  <>
                    {trip.dayCount} days, {trip.dayCount} <span className="serif">moods.</span>
                  </>
                ) : (
                  <>
                    The <span className="serif">route.</span>
                  </>
                )}
              </h2>
            </div>
            {trip.dayCount > 1 && (
              <div className="rsec-aside">
                A suggested split across {trip.dayCount} days with {trip.waypoints.length} waypoints
                to discover along the way.
              </div>
            )}
          </div>

          <div className="itinerary">
            {days.map(({ dayIndex, waypoints }) => {
              const firstStop = waypoints[0];
              const lastStop = waypoints[waypoints.length - 1];
              const dayLabel =
                trip.dayCount > 1 ? `${firstStop?.name ?? ''} → ${lastStop?.name ?? ''}` : null;

              return (
                <div className="day" key={dayIndex}>
                  <div className="day-meta">
                    <div className="day-num">
                      {trip.dayCount > 1 ? `DAY ${String(dayIndex + 1).padStart(2, '0')}` : 'ROUTE'}
                    </div>
                    {dayLabel && <div className="day-route">{dayLabel}</div>}
                    <div className="day-stats">
                      <span>
                        <strong>{waypoints.length}</strong> stops
                      </span>
                    </div>
                  </div>
                  <div className="day-body">
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════ REVIEWS ══════════ */}
      {trip.averageRating != null && trip.reviewCount > 0 && (
        <section className="rsec" id="reviews">
          <div className="rsec-head">
            <div>
              <div className="rsec-meta">Reviews</div>
              <h2 className="rsec-title">
                From <span className="serif">riders.</span>
              </h2>
            </div>
            <div className="rsec-aside">
              {trip.reviewCount} verified {trip.reviewCount === 1 ? 'ride' : 'rides'} logged on this
              route.
            </div>
          </div>
          <div className="reviews-summary">
            <div className="reviews-summary-score">
              <span className="reviews-summary-num">{trip.averageRating.toFixed(1)}</span>
              <span className="reviews-summary-out">/ 5</span>
            </div>
            <div className="reviews-summary-stars">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i}>
                  {i <= Math.round(trip.averageRating ?? 0) ? '\u2605' : '\u2606'}{' '}
                </span>
              ))}
            </div>
            <div className="reviews-summary-count">
              {trip.reviewCount} verified {trip.reviewCount === 1 ? 'ride' : 'rides'}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ END CTA ══════════ */}
      <section className="end-cta">
        <h2 className="end-cta-title">
          Save this ride. <span className="serif">Open the app.</span>
        </h2>
        <p className="end-cta-sub">
          Clone it to your planner, customize dates and stops, then ride. All free.
        </p>
        <div className="end-cta-actions">
          <a
            href="https://apps.apple.com/us/app/motovault-motorcycle-garage/id6760291360"
            className="mv-btn mv-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              Get the app{' '}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Arrow</title>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </a>
          <a href="/explore" className="mv-btn mv-btn-ghost">
            More routes &rarr;
          </a>
        </div>
      </section>
    </>
  );
}
