import {
  WebTripBySlugDocument,
  type WebTripBySlugQuery,
  WebTripReviewsDocument,
  type WebTripReviewsQuery,
} from '@motovault/graphql';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TripDetailMap } from '@/components/trip-detail/trip-detail-map';
import { TripProSection } from '@/components/trip-detail/trip-pro-section';
import { BASE_URL } from '@/lib/constants';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';
import '@/components/trip-detail/trip-detail.css';

type TripData = NonNullable<WebTripBySlugQuery['tripBySlug']>;

interface PageParams {
  params: Promise<{ country: string; region: string; slug: string }>;
}

type TripReview = WebTripReviewsQuery['tripReviews'][number];

async function fetchTrip(country: string, region: string, slug: string): Promise<TripData | null> {
  try {
    const data = await gqlServerFetcher(WebTripBySlugDocument, { country, region, slug });
    return data.tripBySlug ?? null;
  } catch {
    return null;
  }
}

async function fetchReviews(country: string, region: string, slug: string): Promise<TripReview[]> {
  try {
    const data = await gqlServerFetcher(WebTripReviewsDocument, {
      country,
      region,
      slug,
      first: 10,
    });
    return data.tripReviews ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { country, region, slug } = await params;
  const trip = await fetchTrip(country, region, slug);
  if (!trip) return { title: 'Trip Not Found' };

  const countryCode = trip.countryCode ?? country.toUpperCase();
  const countryName = countryDisplayName(countryCode);
  const regionName = trip.regionCode ? regionDisplayName(countryCode, trip.regionCode) : null;
  const dayCount = trip.dayCount ?? 1;
  const title = `${trip.title} — ${dayCount}-Day Motorcycle Trip${regionName ? ` in ${regionName}` : ''}, ${countryName}`;
  const description = trip.description.slice(0, 155);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/trips/${country}/${region}/${slug}`,
      type: 'article',
    },
    alternates: {
      canonical: `${BASE_URL}/trips/${country}/${region}/${slug}`,
    },
  };
}

export const revalidate = 300;

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
  food: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Food</title>
      <path d="M3 8L21 8 21 19 3 19 3 8z" />
      <path d="M3 8L12 14 21 8" />
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
  rally_point: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <title>Rally</title>
      <circle cx="12" cy="12" r="10" />
      <path d="M3 12L21 12" />
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
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatDistance(meters: number): string {
  const km = Math.round(meters / 1000);
  return km.toLocaleString();
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

function buildSections(trip: TripData) {
  const sections: Array<{ id: string; label: string; num: string }> = [];
  let idx = 1;
  sections.push({ id: 'overview', label: 'Overview', num: `/${String(idx++).padStart(2, '0')}` });
  if ((trip.waypoints ?? []).length > 0) {
    sections.push({ id: 'days', label: 'Day-by-day', num: `/${String(idx++).padStart(2, '0')}` });
  }
  if (trip.averageRating != null && trip.reviewCount > 0) {
    sections.push({ id: 'reviews', label: 'Reviews', num: `/${String(idx++).padStart(2, '0')}` });
  }
  return sections;
}

export default async function TripPage({ params }: PageParams) {
  const { country, region, slug } = await params;
  const [trip, reviews] = await Promise.all([
    fetchTrip(country, region, slug),
    fetchReviews(country, region, slug),
  ]);
  if (!trip) notFound();

  const countryCode = trip.countryCode ?? country.toUpperCase();
  const dayCount = trip.dayCount ?? 1;
  const countryName = countryDisplayName(countryCode);
  const regionName = trip.regionCode ? regionDisplayName(countryCode, trip.regionCode) : null;

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
    month: 'short',
    year: 'numeric',
  });

  // Title splitting: put last word on second line with serif
  const titleWords = trip.title.split(' ');
  const lastWord = titleWords.pop() ?? '';
  const firstLine = titleWords.join(' ');

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
        <div className="rh-overlay" />
        <div className="rh-grid" />

        <div className="rh-top">
          <div className="rh-crumb">
            <a href="/explore">Explore</a>
            <span className="rh-crumb-sep">/</span>
            <a href={`/explore/${country}`}>{countryName}</a>
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
              <span className="rh-tag-flag">{countryCode.toUpperCase()}</span>
              {trip.city ? `${trip.city}, ` : ''}
              {countryName}
            </span>
            <span className="rh-tag">
              <span className="rh-tag-dot" />
              {capitalize(trip.difficulty)}
            </span>
            {surfaceLabel && <span className="rh-tag">{surfaceLabel}</span>}
            {dayCount > 1 && <span className="rh-tag">{dayCount}-day trip</span>}
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
            {dayCount > 0 && (
              <div className="rh-stat">
                <div className="rh-stat-label">Duration</div>
                <div className="rh-stat-value">
                  {dayCount} <span className="serif">{dayCount === 1 ? 'day' : 'days'}</span>
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
              <a className="rh-icon-btn" href={`/trips/${country}/${region}/${slug}`}>
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
                  <title>Share</title>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </a>
            </div>
            <div className="rh-author">
              <div className="rh-author-avatar">{getInitials(trip.organiser.displayName)}</div>
              Curated by <strong>{trip.organiser.displayName}</strong> · Updated {updatedLabel}
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
            {/* Quick facts sidebar */}
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
              {dayCount > 0 && (
                <div className="factbox-row">
                  <span className="factbox-key">Days</span>
                  <span className="factbox-val">{dayCount}</span>
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

      {/* ══════════ INTERACTIVE MAP ══════════ */}
      {waypoints.length > 0 && (
        <section className="rsec" style={{ paddingTop: 0 }}>
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

      {/* ══════════ DAY-BY-DAY ══════════ */}
      {days.length > 0 && (
        <section className="rsec" id="days">
          <div className="rsec-head">
            <div>
              <div className="rsec-meta">Day-by-day</div>
              <h2 className="rsec-title">
                {dayCount > 1 ? (
                  <>
                    {dayCount} days, {dayCount} <span className="serif">moods.</span>
                  </>
                ) : (
                  <>
                    The <span className="serif">route.</span>
                  </>
                )}
              </h2>
            </div>
            {dayCount > 1 && (
              <div className="rsec-aside">
                A suggested split across {dayCount} days with {waypoints.length} waypoints to
                discover along the way.
              </div>
            )}
          </div>

          <div className="itinerary">
            {days.map(({ dayIndex, waypoints }) => {
              const firstStop = waypoints[0];
              const lastStop = waypoints[waypoints.length - 1];
              const dayLabel =
                dayCount > 1 ? `${firstStop?.name ?? ''} → ${lastStop?.name ?? ''}` : null;

              return (
                <div className="day" key={dayIndex}>
                  <div className="day-meta">
                    <div className="day-num">
                      {dayCount > 1 ? `DAY ${String(dayIndex + 1).padStart(2, '0')}` : 'ROUTE'}
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

      {/* ══════════ REVIEWS SUMMARY ══════════ */}
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
              {['star-1', 'star-2', 'star-3', 'star-4', 'star-5'].map((key, i) => (
                <span key={key}>
                  {i < Math.round(trip.averageRating ?? 0) ? '\u2605' : '\u2606'}{' '}
                </span>
              ))}
            </div>
            <div className="reviews-summary-count">
              {trip.reviewCount} verified {trip.reviewCount === 1 ? 'ride' : 'rides'}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ INDIVIDUAL REVIEWS ══════════ */}
      {reviews.length > 0 && (
        <section className="rsec" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {reviews.map((review) => {
              const authorName = review.author?.displayName ?? 'Anonymous';
              const initials = getInitials(authorName);
              const reviewDate = new Date(review.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={review.id}
                  style={{
                    background: 'oklch(0.14 0.01 55)',
                    border: '1px solid var(--mv-line)',
                    borderRadius: 16,
                    padding: '24px 28px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'oklch(0.22 0.02 55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--mv-warm-400)',
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{authorName}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--mv-ink-3)',
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {review.bike && (
                          <span>
                            {review.bike.year} {review.bike.make} {review.bike.model}
                          </span>
                        )}
                        <span>{reviewDate}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--mv-warm-400)', flexShrink: 0 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={`${review.id}-star-${star}`}>
                          {star <= review.rating ? '\u2605' : '\u2606'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {review.text && (
                    <p
                      style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--mv-ink-2)', margin: 0 }}
                    >
                      {review.text}
                    </p>
                  )}

                  {review.conditionTags && review.conditionTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {review.conditionTags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'oklch(0.18 0.015 55)',
                            color: 'var(--mv-ink-3)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════ PRO CTA / GPX DOWNLOAD ══════════ */}
      <TripProSection country={country} region={region} slug={slug} routeName={trip.title} />

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
              Get the app
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

      {/* ══════════ STICKY MOBILE APP CTA ══════════ */}
      <div
        className="lg:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: '12px 16px',
          background: 'oklch(0.1 0.01 55 / 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--mv-line)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Open in MotoVault</div>
          <div style={{ fontSize: 12, color: 'var(--mv-ink-3)' }}>Navigate this route with GPS</div>
        </div>
        <a
          href="https://apps.apple.com/us/app/motovault-motorcycle-garage/id6760291360"
          className="mv-btn mv-btn-primary"
          style={{ padding: '10px 20px', fontSize: 13 }}
        >
          <span>Open</span>
        </a>
      </div>
    </>
  );
}
