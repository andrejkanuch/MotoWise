import { TripTemplatesDocument } from '@motovault/graphql';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import { ExploreSearchBar } from '@/components/explore-search-bar';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { fetchCountries } from '@/lib/fetch-places';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

const VALID_DURATIONS = new Set<string>(['short', 'medium', 'long', 'day', 'multi']);
const VALID_COUNTRIES = new Set(Object.keys(COUNTRY_NAMES));

/* ── Helpers ─────────────────────────────────────────────────── */

// All single-day durations (short/medium/long/day) map to dayCountMax:1 because
// the API only has dayCount, not estimated_duration_minutes. Only "multi" is distinct.
function mapDuration(d?: string): { dayCountMin?: number; dayCountMax?: number } {
  if (d === 'multi') return { dayCountMin: 2 };
  if (d && VALID_DURATIONS.has(d)) return { dayCountMax: 1 };
  return {};
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'expert':
      return 'Expert';
    case 'challenging':
      return 'Hard';
    case 'moderate':
      return 'Moderate';
    default:
      return 'Easy';
  }
}

function estimateTime(distanceM: number, surfaceType?: string | null): string {
  const avgSpeed = surfaceType === 'off-road' ? 25 : surfaceType === 'mixed' ? 40 : 60;
  const hours = distanceM / 1000 / avgSpeed;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function tripHref(trip: TripTemplateNode): string {
  if (trip.slug && trip.countryCode && trip.regionCode) {
    return `/trips/${trip.countryCode}/${trip.regionCode}/${trip.slug}`;
  }
  return `/trips/${trip.id}`;
}

/* ── Metadata ────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Search Routes | MotoVault',
  robots: { index: false, follow: true },
};

/* ── Route images ────────────────────────────────────────────── */

const ROUTE_IMAGES = [
  '/images/route-card-placeholder.jpg',
  '/images/route-coastal.jpg',
  '/images/route-forest.jpg',
];

/* ── Page ────────────────────────────────────────────────────── */

export default async function ExploreSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.slice(0, 100) : undefined;
  const rawCountry = typeof params.country === 'string' ? params.country.toUpperCase() : undefined;
  const country = rawCountry && VALID_COUNTRIES.has(rawCountry) ? rawCountry : undefined;
  const rawDuration = typeof params.duration === 'string' ? params.duration : undefined;
  const duration = rawDuration && VALID_DURATIONS.has(rawDuration) ? rawDuration : undefined;

  // Build GraphQL filter
  const filter = {
    ...(q ? { searchText: q } : {}),
    ...(country ? { country: country.toLowerCase() } : {}),
    ...mapDuration(duration),
  };

  // Fetch filtered trips
  let trips: TripTemplateNode[] = [];
  try {
    const data = await gqlServerFetcher(TripTemplatesDocument, { filter, first: 24 });
    trips = data.tripTemplates.edges.map((e) => e.node);
  } catch (err) {
    console.error('[explore/search] Failed to fetch trips:', err);
  }

  // Fetch countries for search bar dropdown
  let allCountries: Array<{ code: string; label: string }> = [];
  try {
    const places = await fetchCountries();
    allCountries = places
      .filter((p) => p.routeCount > 0)
      .sort((a, b) => b.routeCount - a.routeCount)
      .map((p) => ({ code: p.countryCode.toUpperCase(), label: p.name }));
  } catch (err) {
    console.error('[explore/search] Failed to fetch countries:', err);
  }

  // Build search summary
  const summaryParts = [
    q && `"${q}"`,
    country && (COUNTRY_NAMES[country] ?? country),
    duration === 'multi' ? 'multi-day' : undefined,
  ].filter(Boolean);
  const searchSummary = summaryParts.length > 0 ? summaryParts.join(' in ') : '';

  return (
    <>
      {/* ===== SEARCH HERO ===== */}
      <section
        style={{
          position: 'relative',
          padding: '140px 40px 56px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="mv-section-meta" style={{ margin: 0 }}>
            Search results
          </div>
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 4.5vw, 56px)',
            fontWeight: 500,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            margin: '18px 0 0',
            maxWidth: 900,
          }}
        >
          {trips.length > 0 ? (
            <>
              {trips.length} route{trips.length !== 1 ? 's' : ''}
              {searchSummary && (
                <>
                  {' '}
                  for{' '}
                  <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                    {searchSummary}.
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              No routes found
              {searchSummary && (
                <>
                  {' '}
                  for{' '}
                  <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                    {searchSummary}.
                  </span>
                </>
              )}
            </>
          )}
        </h1>

        <Suspense>
          <ExploreSearchBar countries={allCountries} />
        </Suspense>
      </section>

      {/* ===== RESULTS ===== */}
      <section
        style={{
          padding: '0 40px 120px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
        {trips.length > 0 ? (
          <div className="mv-grid-4" style={{ gap: 20 }}>
            {trips.map((trip) => {
              const difficultyLabel = getDifficultyLabel(trip.difficulty);
              const imageIndex = trip.id.charCodeAt(0) % ROUTE_IMAGES.length;
              const imageSrc = ROUTE_IMAGES[imageIndex];

              return (
                <a
                  key={trip.id}
                  href={tripHref(trip)}
                  style={{
                    position: 'relative',
                    display: 'block',
                    aspectRatio: '4/3',
                    borderRadius: 'var(--mv-radius)',
                    overflow: 'hidden',
                    background: 'var(--mv-surface)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'transform 0.5s var(--mv-ease)',
                  }}
                  className="group"
                >
                  {/* Background image */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      transition: 'transform 0.8s var(--mv-ease-expo), filter 0.4s',
                      filter: 'saturate(0.9) brightness(0.6)',
                    }}
                    className="group-hover:scale-[1.06] group-hover:brightness-[0.72] group-hover:saturate-100"
                  >
                    <Image
                      src={imageSrc}
                      alt={trip.title ?? 'Route'}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                  </div>

                  {/* Gradient overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, oklch(0.08 0.008 55 / 0.5) 0%, transparent 30%, transparent 45%, oklch(0.08 0.008 55 / 0.95) 100%)',
                      zIndex: 1,
                    }}
                    aria-hidden="true"
                  />

                  {/* Country badge */}
                  {trip.countryCode && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 22,
                        left: 20,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 12px 5px 5px',
                        background: 'oklch(0.1 0.008 55 / 0.6)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid var(--mv-line)',
                        borderRadius: 999,
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-2)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        zIndex: 2,
                      }}
                    >
                      {COUNTRY_NAMES[trip.countryCode] ?? trip.countryCode}
                    </span>
                  )}

                  {/* Body content */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 24,
                      right: 24,
                      bottom: 24,
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.08,
                      }}
                    >
                      {trip.title ?? 'Unnamed Route'}
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap' as const,
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-2)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                      }}
                    >
                      {trip.distanceM != null && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: 'var(--mv-warm-500)',
                            }}
                          />
                          {formatDistance(trip.distanceM)}
                        </span>
                      )}
                      {trip.distanceM != null && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: 'var(--mv-warm-500)',
                            }}
                          />
                          {estimateTime(trip.distanceM, trip.surfaceType)}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: 'var(--mv-warm-500)',
                          }}
                        />
                        {difficultyLabel}
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
            }}
          >
            <p
              style={{
                color: 'var(--mv-ink-3)',
                fontSize: 16,
                maxWidth: 400,
                margin: '0 auto',
                lineHeight: 1.55,
              }}
            >
              Try broadening your search, picking a different country, or browse our curated
              collections.
            </p>
            <a href="/explore" className="mv-btn mv-btn-primary" style={{ marginTop: 28 }}>
              Explore all routes &rarr;
            </a>
          </div>
        )}
      </section>
    </>
  );
}
