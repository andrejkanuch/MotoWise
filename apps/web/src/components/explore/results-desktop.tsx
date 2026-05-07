'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { FilterBar, type FilterState } from './filter-bar';
import { MapboxMap } from './mapbox-map';
import { Flag, Icon, MonoLabel } from './primitives';
import { TripListCard } from './trip-list-card';
import { applyFilters } from './utils';

/* ── Breadcrumb ───────────────────────────────────────────────── */

function ResultsBreadcrumb({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      {items.map((it, i) => (
        <span key={it} style={{ display: 'contents' }}>
          <a
            href={i === 0 ? '/explore' : '#'}
            style={{
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 10.5,
              color: i === items.length - 1 ? 'var(--mv-warm-400)' : 'var(--mv-ink-3)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            {it}
          </a>
          {i < items.length - 1 && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                color: 'var(--mv-ink-4)',
                fontSize: 10,
              }}
            >
              /
            </span>
          )}
        </span>
      ))}
    </div>
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
    <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--mv-line)' }}>
      <ResultsBreadcrumb items={region ? ['Explore', country, region] : ['Explore', country]} />
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Flag code={countryCode} w={28} h={20} />
        <h1
          style={{
            fontSize: 26,
            fontWeight: 500,
            margin: 0,
            letterSpacing: '-0.025em',
          }}
        >
          Routes in{' '}
          <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
            {region ?? country}
          </span>
        </h1>
        <MonoLabel>
          {routeCount} routes · {regionCount} regions
        </MonoLabel>
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          margin: '0 auto',
          borderRadius: 999,
          border: '1px solid var(--mv-line)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--mv-ink-3)',
        }}
      >
        <Icon name="search" size={24} />
      </div>
      <h3
        style={{
          marginTop: 22,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '-0.01em',
        }}
      >
        No routes{' '}
        <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
          match these filters.
        </span>
      </h3>
      <p
        style={{
          marginTop: 10,
          color: 'var(--mv-ink-3)',
          fontSize: 13.5,
          lineHeight: 1.55,
          maxWidth: 320,
          margin: '10px auto 0',
        }}
      >
        Try clearing a filter, widening the distance range, or browsing a neighbouring region.
      </p>
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
  const [filters, setFilters] = useState<FilterState>({
    difficulty: '',
    surface: '',
    sort: 'rating',
  });
  const listRef = useRef<HTMLDivElement>(null);

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
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

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
          gridTemplateColumns: '440px 1fr',
          minHeight: 0,
        }}
      >
        {/* List */}
        <div
          ref={listRef}
          style={{
            borderRight: '1px solid var(--mv-line)',
            overflowY: 'auto',
            padding: '20px 20px 60px',
            background: 'var(--mv-bg, oklch(0.12 0.01 55))',
          }}
        >
          {trips.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 4px 14px',
                }}
              >
                <MonoLabel>Showing {trips.length} routes</MonoLabel>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {trips.map((t, i) => (
                  <TripListCard
                    key={t.id}
                    trip={t}
                    idx={i}
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
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              background: 'oklch(0.1 0.008 55 / 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--mv-line)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'var(--mv-warm-500)',
                boxShadow: '0 0 8px var(--mv-warm-500)',
              }}
            />
            <MonoLabel size={10}>{trips.length} routes shown</MonoLabel>
          </div>
        </div>
      </div>
    </>
  );
}
