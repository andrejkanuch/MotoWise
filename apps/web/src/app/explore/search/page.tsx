import { TripTemplatesDocument } from '@motovault/graphql';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TripListCard } from '@/components/explore/trip-list-card';
import { ExploreSearchBar } from '@/components/explore-search-bar';
import {
  buildSearchAttempts,
  type DropKey,
  DURATION_LABELS,
  VALID_DURATIONS,
} from '@/lib/explore-filters';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { fetchCountries } from '@/lib/fetch-places';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

const VALID_COUNTRIES = new Set(Object.keys(COUNTRY_NAMES));

/* ── Helpers ─────────────────────────────────────────────────── */

const AVERAGE_SPEED_KMH: Record<string, number> = {
  'off-road': 25,
  mixed: 40,
  paved: 60,
};

/** Riding time from distance and surface when the route carries no estimate. */
function estimateMinutes(distanceM: number, surfaceType?: string | null): number {
  const speed = AVERAGE_SPEED_KMH[surfaceType ?? 'paved'] ?? AVERAGE_SPEED_KMH.paved;
  return Math.round((distanceM / 1000 / speed) * 60);
}

function withRidingTime(trip: TripTemplateNode): TripTemplateNode {
  if (trip.estimatedDurationMinutes != null || trip.distanceM == null) return trip;
  return { ...trip, estimatedDurationMinutes: estimateMinutes(trip.distanceM, trip.surfaceType) };
}

function splitColumns<T>(items: T[]): [T[], T[]] {
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

/* ── Metadata ────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: { absolute: 'Search routes | MotoVault' },
  robots: { index: false, follow: true },
};

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

  // A specific query (text + country + length) can dead-end when one input has
  // no matches — e.g. a city we don't cover yet. Rather than show "No routes
  // found", walk a fallback ladder that progressively relaxes the least-
  // essential filters and surfaces the closest routes we do have.
  const attempts = buildSearchAttempts({ q, country, duration });

  let trips: TripTemplateNode[] = [];
  let dropped: DropKey[] = [];
  for (const attempt of attempts) {
    try {
      const data = await gqlServerFetcher(TripTemplatesDocument, {
        filter: attempt.filter,
        first: 24,
      });
      const nodes = data.tripTemplates.edges.map((e) => e.node);
      if (nodes.length > 0) {
        trips = nodes;
        dropped = attempt.dropped;
        break;
      }
    } catch (err) {
      console.error('[explore/search] Failed to fetch trips:', err);
      break;
    }
  }
  const isFallback = trips.length > 0 && dropped.length > 0;

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

  // Build search summaries. `searchSummary` describes the user's full query;
  // `keptSummary` describes the (broadened) query that actually returned routes.
  const countryName = country ? (COUNTRY_NAMES[country] ?? country) : undefined;
  const durationLabel = duration ? DURATION_LABELS[duration] : undefined;
  const summarize = (parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' · ');

  const searchSummary = summarize([q && `"${q}"`, countryName, durationLabel]);
  const keptSummary = summarize([
    !dropped.includes('query') && q && `"${q}"`,
    !dropped.includes('country') && countryName,
    !dropped.includes('duration') && durationLabel,
  ]);
  const fallbackNotice = keptSummary
    ? `No routes match ${searchSummary}. Here are the closest routes (${keptSummary}) instead.`
    : `No routes match ${searchSummary}. Here are the most-ridden routes instead.`;

  const count = trips.length;
  const [left, right] = splitColumns(trips.map(withRidingTime));

  return (
    <>
      {/* ===== SEARCH HERO ===== */}
      <section className="xp-wrap" style={{ paddingTop: 120 }}>
        <h1 className="mv-section-title xp-h1 xp-h1-sm xp-rise">
          {count > 0 ? (
            <>
              {count} {count === 1 ? 'route' : 'routes'}
              {!isFallback && searchSummary ? ` for ${searchSummary}` : ''}
            </>
          ) : (
            <>No routes{searchSummary ? ` for ${searchSummary}` : ''}</>
          )}
        </h1>
        <div style={{ marginTop: 32 }}>
          <Suspense>
            <ExploreSearchBar countries={allCountries} />
          </Suspense>
        </div>
      </section>

      {/* ===== RESULTS ===== */}
      <section className="xp-wrap" style={{ paddingTop: 48, paddingBottom: 120 }}>
        {isFallback && <output className="xp-notice">{fallbackNotice}</output>}
        {count > 0 ? (
          <div className="xp-rows-2">
            <div className="mv-rows">
              {left.map((trip) => (
                <TripListCard key={trip.id} trip={trip} />
              ))}
            </div>
            {right.length > 0 && (
              <div className="mv-rows">
                {right.map((trip) => (
                  <TripListCard key={trip.id} trip={trip} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="xp-empty" style={{ padding: '24px 0 0' }}>
            <p>
              Try a shorter search, another country, or any length. Every route we hold is on the
              explore page, grouped by country.
            </p>
            <a href="/explore" className="mv-btn mv-btn-primary" style={{ marginTop: 24 }}>
              Browse all routes
            </a>
          </div>
        )}
      </section>
    </>
  );
}
