'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { DEFAULT_FILTERS, FilterBar, type FilterState } from './filter-bar';
import { MapboxMap } from './mapbox-map';
import { Icon, MetaLabel, RouteFigures } from './primitives';
import { LoadFailedState, ZeroRoutesState } from './results-desktop';
import { TripListCard } from './trip-list-card';
import { applyFilters, formatNumber, tripHref } from './utils';

/* ── Mobile topbar: opaque ground, hairline, 44px targets ─────── */

/**
 * The topbar collapses to one line past COLLAPSE_AT px of page scroll and
 * opens again under EXPAND_AT. The gap is wider than the 17px the bar loses,
 * so scroll anchoring's compensation can never flip it back and forth.
 */
const TOPBAR_COLLAPSE_AT = 64;
const TOPBAR_EXPAND_AT = 8;

function useTopbarCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const update = () =>
      setCollapsed((was) =>
        was ? window.scrollY > TOPBAR_EXPAND_AT : window.scrollY > TOPBAR_COLLAPSE_AT,
      );
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return collapsed;
}

function MobileTopbar({
  country,
  countryCode,
  region,
}: {
  country: string;
  countryCode: string;
  region?: string | null;
}) {
  const backHref = region ? `/explore/${countryCode.toLowerCase()}` : '/explore';
  const backLabel = region ? `Back to ${country}` : 'Back to explore';
  const scrolled = useTopbarCollapsed();
  return (
    <div className="xp-mtop" data-scrolled={scrolled || undefined}>
      <a href={backHref} className="mv-icon-btn" aria-label={backLabel}>
        <Icon name="arrow-left" size={18} />
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* The phone's one heading: the desktop tree is display:none here */}
        <h1 className="xp-mtop-title">Routes in {region ?? country}</h1>
        <MetaLabel>{region ? `Explore · ${country}` : 'Explore'}</MetaLabel>
      </div>
      <a href="/explore" className="mv-icon-btn" aria-label="Search routes">
        <Icon name="search" size={18} />
      </a>
    </div>
  );
}

/* ── Main layout ──────────────────────────────────────────────── */

interface ResultsMobileProps {
  allTrips: TripTemplateNode[];
  /** The API did not answer: say so instead of "no routes match". */
  loadFailed?: boolean;
  country: string;
  countryCode?: string;
  region?: string | null;
  mapCenter?: [number, number];
  mapZoom?: number;
}

export function ResultsMobile({
  allTrips,
  loadFailed = false,
  country,
  countryCode = '',
  region,
  mapCenter,
  mapZoom,
}: ResultsMobileProps) {
  const searchParams = useSearchParams();
  const [mapMode, setMapMode] = useState(false);
  // Filters start from the URL (?difficulty=&surface=&sort=) and are then
  // edited in place, so a shared link still opens filtered.
  const [filters, setFilters] = useState<FilterState>(() => ({
    difficulty: searchParams.get('difficulty') ?? DEFAULT_FILTERS.difficulty,
    surface: searchParams.get('surface') ?? DEFAULT_FILTERS.surface,
    sort: searchParams.get('sort') ?? DEFAULT_FILTERS.sort,
  }));

  const trips = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.difficulty) p.set('difficulty', filters.difficulty);
    if (filters.surface) p.set('surface', filters.surface);
    if (filters.sort) p.set('sort', filters.sort);
    return applyFilters(allTrips, p);
  }, [allTrips, filters]);

  const focusedTrip = trips[0] ?? null;
  const countLabel = `${formatNumber(trips.length)} ${trips.length === 1 ? 'route' : 'routes'}`;
  const placeName = region ?? country;
  const clearFilters = useCallback(
    () => setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort })),
    [],
  );

  return (
    <div className="xp-mresults">
      <MobileTopbar country={country} countryCode={countryCode} region={region} />

      {!mapMode && (
        <>
          <div className="xp-mfilters">
            <FilterBar filters={filters} onFilterChange={setFilters} />
          </div>
          <div className="xp-mlist">
            {loadFailed ? (
              <LoadFailedState />
            ) : allTrips.length === 0 ? (
              <ZeroRoutesState country={country} countryCode={countryCode} region={region} />
            ) : trips.length === 0 ? (
              <div className="xp-empty">
                <h2 className="mv-h3 xp-h3">No routes match these filters</h2>
                <p>Clear a filter to see every route in {placeName}.</p>
                <button type="button" className="mv-link is-tall" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div style={{ paddingBottom: 12 }}>
                  <MetaLabel>Showing {countLabel}</MetaLabel>
                </div>
                <div className="mv-rows">
                  {trips.map((t) => (
                    <TripListCard key={t.id} trip={t} />
                  ))}
                </div>
              </>
            )}
          </div>
          {!loadFailed && (
            <button
              type="button"
              onClick={() => setMapMode(true)}
              className="mv-btn mv-btn-primary xp-fab mv-enter-up"
            >
              <Icon name="map" size={16} /> Show map
            </button>
          )}
        </>
      )}

      {mapMode && (
        <>
          <section
            aria-label={`Map of routes in ${placeName}`}
            style={{ flex: 1, position: 'relative', minHeight: 0 }}
          >
            <MapboxMap
              trips={trips}
              hoveredId={null}
              focusedId={focusedTrip?.id ?? null}
              center={mapCenter}
              zoom={mapZoom}
            />
            {focusedTrip && (
              <a href={tripHref(focusedTrip)} className="xp-map-sheet mv-enter-up">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="mv-row-title" style={{ display: 'block' }}>
                    {focusedTrip.title ?? 'Unnamed route'}
                  </span>
                  <span className="mv-row-sub">
                    {[focusedTrip.city ?? focusedTrip.regionCode, focusedTrip.countryCode]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                  <span style={{ display: 'block', marginTop: 10 }}>
                    <RouteFigures trip={focusedTrip} withLabels={false} />
                  </span>
                </span>
                <Icon name="arrow-right" size={16} color="var(--mv-ink-3)" />
              </a>
            )}
          </section>
          <button
            type="button"
            onClick={() => setMapMode(false)}
            className="mv-btn mv-btn-primary xp-fab mv-enter-up"
          >
            <Icon name="list" size={16} /> Show list
          </button>
        </>
      )}
    </div>
  );
}
