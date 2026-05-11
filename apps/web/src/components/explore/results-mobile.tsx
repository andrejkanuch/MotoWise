'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { MapboxMap } from './mapbox-map';
import { Icon, MonoLabel } from './primitives';
import { TripListCard } from './trip-list-card';
import { applyFilters } from './utils';

/* ── Mobile topbar ────────────────────────────────────────────── */

function MobileTopbar({ country, region }: { country: string; region?: string | null }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '14px 18px',
        background: 'oklch(0.08 0.008 55 / 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--mv-line)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <a
        href="/explore"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'oklch(1 0 0 / 0.04)',
          border: '1px solid var(--mv-line)',
          color: 'var(--mv-ink)',
          display: 'grid',
          placeItems: 'center',
          textDecoration: 'none',
        }}
      >
        <Icon name="arrow-right" size={14} color="var(--mv-ink)" />
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 9.5,
            color: 'var(--mv-ink-3)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Explore / {country}
          {region ? ` / ${region}` : ''}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Routes in{' '}
          <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
            {region ?? country}
          </span>
        </div>
      </div>
      <a
        href="/explore"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'oklch(1 0 0 / 0.04)',
          border: '1px solid var(--mv-line)',
          color: 'var(--mv-ink-2)',
          display: 'grid',
          placeItems: 'center',
          textDecoration: 'none',
        }}
      >
        <Icon name="search" size={14} />
      </a>
    </div>
  );
}

/* ── Mobile filter scroll ─────────────────────────────────────── */

function MobileFilterScroll() {
  const filters = [
    { label: 'Sort', value: 'Rating', active: true },
    { label: 'Difficulty', value: 'Any', active: false },
    { label: 'Surface', value: 'Any', active: false },
    { label: 'Distance', value: 'Any', active: false },
  ];
  return (
    <div
      style={{
        position: 'sticky',
        top: 67,
        zIndex: 9,
        background: 'var(--mv-bg, oklch(0.12 0.01 55))',
        borderBottom: '1px solid var(--mv-line)',
        padding: '12px 0 12px 18px',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {filters.map((f) => (
        <button
          type="button"
          key={f.label}
          style={{
            flexShrink: 0,
            padding: '7px 11px',
            borderRadius: 999,
            background: f.active ? 'oklch(0.84 0.15 68 / 0.13)' : 'oklch(1 0 0 / 0.03)',
            border: `1px solid ${f.active ? 'oklch(0.84 0.15 68 / 0.5)' : 'var(--mv-line)'}`,
            color: f.active ? 'var(--mv-warm-300)' : 'var(--mv-ink-2)',
            fontFamily: 'inherit',
            fontSize: 12,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.65,
            }}
          >
            {f.label}
          </span>
          {f.value} <Icon name="chevron-down" size={9} />
        </button>
      ))}
      <span style={{ width: 18, flexShrink: 0 }} />
    </div>
  );
}

/* ── Main layout ──────────────────────────────────────────────── */

interface ResultsMobileProps {
  allTrips: TripTemplateNode[];
  country: string;
  region?: string | null;
  mapCenter?: [number, number];
  mapZoom?: number;
}

export function ResultsMobile({
  allTrips,
  country,
  region,
  mapCenter,
  mapZoom,
}: ResultsMobileProps) {
  const searchParams = useSearchParams();
  const [mapMode, setMapMode] = useState(false);
  const trips = applyFilters(allTrips, searchParams);
  const focusedTrip = trips[0] ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        position: 'relative',
      }}
    >
      <MobileTopbar country={country} region={region} />

      {!mapMode && (
        <>
          <MobileFilterScroll />
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 100px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <MonoLabel>{trips.length} routes shown</MonoLabel>
              <span
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                ↓ Most loved first
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {trips.map((t, i) => (
                <TripListCard key={t.id} trip={t} idx={i} />
              ))}
            </div>
          </div>
          {/* Sticky map pill */}
          <button
            type="button"
            onClick={() => setMapMode(true)}
            style={{
              position: 'fixed',
              bottom: 28,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              borderRadius: 999,
              background: 'var(--mv-ink)',
              color: '#000',
              boxShadow: '0 12px 30px -6px oklch(0 0 0 / 0.6)',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 5,
              border: 'none',
            }}
          >
            <Icon name="map" size={13} color="#000" /> Show map
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 10,
                color: 'oklch(0 0 0 / 0.5)',
                letterSpacing: '0.08em',
                marginLeft: 4,
              }}
            >
              {trips.length}
            </span>
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
            {/* Bottom sheet card */}
            {focusedTrip && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 80,
                  left: 18,
                  right: 18,
                  background: 'var(--mv-surface)',
                  border: '1px solid var(--mv-line)',
                  borderRadius: 18,
                  padding: 14,
                  boxShadow: '0 18px 40px -8px oklch(0 0 0 / 0.7)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, oklch(0.28 0.06 50), oklch(0.13 0.02 30))',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 9.5,
                      color: 'var(--mv-warm-400)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {focusedTrip.city ?? focusedTrip.regionCode ?? ''},{' '}
                    {focusedTrip.countryCode ?? ''} · No 01
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 14.5,
                      fontWeight: 500,
                      letterSpacing: '-0.01em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {focusedTrip.title ?? 'Unnamed'}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 12,
                    }}
                  >
                    {focusedTrip.distanceM != null && (
                      <span
                        style={{
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 10.5,
                          color: 'var(--mv-ink-2)',
                        }}
                      >
                        {Math.round(focusedTrip.distanceM / 1000)}km
                      </span>
                    )}
                    {focusedTrip.elevationGainM != null && (
                      <span
                        style={{
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 10.5,
                          color: 'var(--mv-ink-2)',
                        }}
                      >
                        ↑ {focusedTrip.elevationGainM}m
                      </span>
                    )}
                    {focusedTrip.averageRating != null && (
                      <span
                        style={{
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 10.5,
                          color: 'var(--mv-warm-400)',
                        }}
                      >
                        ★ {focusedTrip.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* List pill */}
          <button
            type="button"
            onClick={() => setMapMode(false)}
            style={{
              position: 'fixed',
              bottom: 28,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 22px',
              borderRadius: 999,
              background: 'var(--mv-ink)',
              color: '#000',
              boxShadow: '0 12px 30px -6px oklch(0 0 0 / 0.6)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 5,
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            <Icon name="list" size={13} color="#000" /> Show list
          </button>
        </>
      )}
    </div>
  );
}
