'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { DEFAULT_FILTERS, FilterBar, type FilterState } from './filter-bar';
import { MapboxMap } from './mapbox-map';
import { Icon, MetaLabel, RouteFigures } from './primitives';
import { TripListCard } from './trip-list-card';
import { applyFilters, formatNumber, tripHref } from './utils';

/* ── Mobile topbar: opaque ground, hairline, 44px targets ─────── */

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
  return (
    <div className="xp-mtop">
      <a href={backHref} className="xp-icon-btn" aria-label={backLabel}>
        <Icon name="arrow-left" size={18} />
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MetaLabel>{region ? `Explore · ${country}` : 'Explore'}</MetaLabel>
        <div
          className="xp-h3"
          style={{
            marginTop: 2,
            fontSize: 24,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Routes in {region ?? country}
        </div>
      </div>
      <a href="/explore" className="xp-icon-btn" aria-label="Search routes">
        <Icon name="search" size={18} />
      </a>
    </div>
  );
}

/* ── Main layout ──────────────────────────────────────────────── */

interface ResultsMobileProps {
  allTrips: TripTemplateNode[];
  country: string;
  countryCode?: string;
  region?: string | null;
  mapCenter?: [number, number];
  mapZoom?: number;
}

export function ResultsMobile({
  allTrips,
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        position: 'relative',
      }}
    >
      <MobileTopbar country={country} countryCode={countryCode} region={region} />

      {!mapMode && (
        <>
          <div style={{ position: 'sticky', top: 65, zIndex: 9 }}>
            <FilterBar filters={filters} onFilterChange={setFilters} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 112px' }}>
            {trips.length === 0 ? (
              <div className="xp-empty">
                <h3 className="xp-h3">No routes match these filters</h3>
                <p>Clear a filter to see every route in {region ?? country}.</p>
              </div>
            ) : (
              <>
                <div style={{ paddingBottom: 12 }}>
                  <MetaLabel>Showing {countLabel}</MetaLabel>
                </div>
                <div className="xp-rows">
                  {trips.map((t) => (
                    <TripListCard key={t.id} trip={t} />
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMapMode(true)}
            className="mv-btn mv-btn-primary xp-fab"
          >
            <Icon name="map" size={16} /> Show map
          </button>
        </>
      )}

      {mapMode && (
        <>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <MapboxMap
              trips={trips}
              hoveredId={null}
              focusedId={focusedTrip?.id ?? null}
              center={mapCenter}
              zoom={mapZoom}
            />
            {focusedTrip && (
              <a href={tripHref(focusedTrip)} className="xp-map-sheet">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="xp-row-title" style={{ display: 'block' }}>
                    {focusedTrip.title ?? 'Unnamed route'}
                  </span>
                  <span className="xp-row-meta" style={{ display: 'block' }}>
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
          </div>
          <button
            type="button"
            onClick={() => setMapMode(false)}
            className="mv-btn mv-btn-primary xp-fab"
          >
            <Icon name="list" size={16} /> Show list
          </button>
        </>
      )}
    </div>
  );
}
