'use client';

import { useCallback, useMemo, useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { DEFAULT_FILTERS, FilterBar, type FilterState } from './filter-bar';
import { MapboxMap } from './mapbox-map';
import { Icon, MetaLabel } from './primitives';
import { TripListCard } from './trip-list-card';
import { applyFilters, formatNumber } from './utils';

/* ── Breadcrumb ───────────────────────────────────────────────── */

function ResultsBreadcrumb({
  country,
  countryCode,
  region,
}: {
  country: string;
  countryCode: string;
  region?: string | null;
}) {
  const countryHref = `/explore/${countryCode.toLowerCase()}`;
  return (
    <nav aria-label="Breadcrumb">
      <ol className="mv-crumbs">
        <li>
          <a href="/explore">Explore</a>
        </li>
        {region ? (
          <>
            <li>
              <Icon name="chevron-right" size={14} />
              <a href={countryHref}>{country}</a>
            </li>
            <li>
              <Icon name="chevron-right" size={14} />
              <span aria-current="page">{region}</span>
            </li>
          </>
        ) : (
          <li>
            <Icon name="chevron-right" size={14} />
            <span aria-current="page">{country}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}

/* ── Header ───────────────────────────────────────────────────── */

function ResultsHeader({
  country,
  countryCode,
  region,
  regionCount,
  routeCount,
}: {
  country: string;
  countryCode: string;
  region?: string | null;
  regionCount: number;
  routeCount: number;
}) {
  return (
    <div className="xp-results-head">
      <ResultsBreadcrumb country={country} countryCode={countryCode} region={region} />
      <h1 className="xp-results-title">Routes in {region ?? country}</h1>
      <p className="xp-results-count">
        <span className="mv-figure">{formatNumber(routeCount)}</span>{' '}
        {routeCount === 1 ? 'route' : 'routes'}
        {!region && regionCount > 0 && (
          <>
            {' · '}
            <span className="mv-figure">{formatNumber(regionCount)}</span>{' '}
            {regionCount === 1 ? 'region' : 'regions'}
          </>
        )}
      </p>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────── */

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="xp-empty">
      <h3 className="mv-h3 xp-h3">No routes match these filters</h3>
      <p>Clear a filter, or browse a neighbouring region from the map.</p>
      <button type="button" className="mv-link is-tall" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

/* ── Main layout ──────────────────────────────────────────────── */

interface ResultsDesktopProps {
  allTrips: TripTemplateNode[];
  country: string;
  countryCode: string;
  region?: string | null;
  regionCount: number;
  mapCenter?: [number, number];
  mapZoom?: number;
}

export function ResultsDesktop({
  allTrips,
  country,
  countryCode,
  region,
  regionCount,
  mapCenter,
  mapZoom,
}: ResultsDesktopProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Build URLSearchParams from local state for applyFilters
  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.difficulty) p.set('difficulty', filters.difficulty);
    if (filters.surface) p.set('surface', filters.surface);
    if (filters.sort) p.set('sort', filters.sort);
    return p;
  }, [filters]);

  const trips = useMemo(() => applyFilters(allTrips, filterParams), [allTrips, filterParams]);

  // Set of visible trip IDs for map marker toggling (no map re-render)
  const visibleIds = useMemo(() => new Set(trips.map((t) => t.id)), [trips]);

  const handlePinClick = useCallback((id: string) => {
    setFocusedId(id);
    setHoveredId(id);
    const el = document.querySelector(`[data-trip-id="${CSS.escape(id)}"]`);
    if (el) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
  }, []);

  const clearFilters = useCallback(
    () => setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort })),
    [],
  );

  return (
    <>
      <ResultsHeader
        country={country}
        countryCode={countryCode}
        region={region}
        regionCount={regionCount}
        routeCount={trips.length}
      />
      <FilterBar filters={filters} onFilterChange={setFilters} />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'clamp(360px, 38vw, 520px) 1fr',
          minHeight: 0,
        }}
      >
        {/* List */}
        {/* min-height:0 (in .xp-results-list) lets this grid item scroll
            internally; without it the item keeps its intrinsic content height,
            ballooning the grid row (and the height:100% map next to it). */}
        <div className="xp-results-list">
          {trips.length === 0 ? (
            <EmptyState onClear={clearFilters} />
          ) : (
            <>
              <div style={{ padding: '4px 0 12px' }}>
                <MetaLabel>
                  Showing {formatNumber(trips.length)} {trips.length === 1 ? 'route' : 'routes'}
                </MetaLabel>
              </div>
              <div className="mv-rows">
                {trips.map((t) => (
                  <TripListCard
                    key={t.id}
                    trip={t}
                    hovered={hoveredId === t.id}
                    focused={focusedId === t.id}
                    onMouseEnter={() => setHoveredId(t.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Map — receives ALL trips, visibility controlled via visibleIds */}
        <div style={{ position: 'relative', minWidth: 0 }}>
          <MapboxMap
            trips={allTrips}
            hoveredId={hoveredId}
            focusedId={focusedId}
            onPinClick={handlePinClick}
            center={mapCenter}
            zoom={mapZoom}
            visibleIds={visibleIds}
          />
          <div className="xp-map-badge">
            <span className="mv-figure">{formatNumber(trips.length)}</span>
            {trips.length === 1 ? 'route on the map' : 'routes on the map'}
          </div>
        </div>
      </div>
    </>
  );
}
