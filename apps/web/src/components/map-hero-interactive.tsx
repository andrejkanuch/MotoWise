'use client';

import { palette } from '@motovault/design-system';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodePolyline } from '@/lib/decode-polyline';

/* ------------------------------------------------------------------ */
/*  Difficulty color coding                                           */
/* ------------------------------------------------------------------ */

const SURFACE_COLORS = {
  paved: palette.primary500,
  mixed: palette.warning500,
  'off-road': palette.danger500,
  unknown: palette.neutral400,
} as const;

const SURFACE_LABELS = {
  paved: 'Paved',
  mixed: 'Mixed',
  'off-road': 'Off-Road',
  unknown: 'Unknown',
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface RouteData {
  id: string;
  name: string | null | undefined;
  polyline: string;
  distanceM: number;
  elevationGainM: number | null | undefined;
  surfaceType: string | null | undefined;
  curvatureIndex: number | null | undefined;
  ratingAvg: number | null | undefined;
  ratingCount: number;
}

interface MapHeroInteractiveProps {
  route: RouteData;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function MapHeroInteractive({ route }: MapHeroInteractiveProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const surfaceKey = (route.surfaceType ?? 'unknown') as keyof typeof SURFACE_COLORS;
  const routeColor = SURFACE_COLORS[surfaceKey] ?? SURFACE_COLORS.unknown;

  const coordinates = decodePolyline(route.polyline);
  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1];

  const formatDistance = useCallback((meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }, []);

  const formatElevation = useCallback((meters: number) => {
    return `${Math.round(meters)} m`;
  }, []);

  /* ---- Initialize map ---- */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: startCoord as [number, number],
      zoom: 10,
      attributionControl: false,
    });

    mapRef.current = map;

    /* ---- Controls ---- */
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    map.on('load', () => {
      /* ---- Route line ---- */
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });

      // Casing (border) layer for depth
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': palette.neutral900,
          'line-width': 6,
          'line-opacity': 0.3,
        },
      });

      // Main route layer
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': routeColor,
          'line-width': 4,
        },
      });

      /* ---- Start marker ---- */
      if (startCoord) {
        const startEl = document.createElement('div');
        startEl.className = 'map-marker map-marker--start';
        startEl.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:${palette.success500};border:3px solid ${palette.white};box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
        new mapboxgl.Marker({ element: startEl })
          .setLngLat(startCoord as [number, number])
          .addTo(map);
      }

      /* ---- End marker ---- */
      if (endCoord) {
        const endEl = document.createElement('div');
        endEl.className = 'map-marker map-marker--end';
        endEl.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:${palette.danger500};border:3px solid ${palette.white};box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
        new mapboxgl.Marker({ element: endEl })
          .setLngLat(endCoord as [number, number])
          .addTo(map);
      }

      /* ---- Fit bounds to route ---- */
      const bounds = new mapboxgl.LngLatBounds();
      for (const coord of coordinates) {
        bounds.extend(coord as [number, number]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });

      /* ---- Click handler on route line ---- */
      map.on('click', 'route-line', () => {
        setShowPreview(true);
      });

      map.on('mouseenter', 'route-line', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'route-line', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Fullscreen toggle ---- */
  const toggleFullscreen = useCallback(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // Trigger map resize when fullscreen changes
      setTimeout(() => mapRef.current?.resize(), 100);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div className="relative w-full" style={{ minHeight: isFullscreen ? '100vh' : undefined }}>
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="h-[300px] w-full sm:h-[400px] md:h-[500px]"
        style={isFullscreen ? { height: '100vh', width: '100vw' } : undefined}
      />

      {/* Fullscreen toggle button */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg shadow-md transition-colors"
        style={{
          backgroundColor: palette.white,
          color: palette.neutral700,
        }}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18-5h-3a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 z-10 rounded-lg p-3 shadow-md"
        style={{ backgroundColor: `${palette.white}ee` }}
      >
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: palette.neutral600 }}
        >
          Surface Type
        </p>
        <div className="flex flex-col gap-1.5">
          {(Object.entries(SURFACE_COLORS) as [keyof typeof SURFACE_COLORS, string][]).map(
            ([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span
                  className="text-xs"
                  style={{
                    color: palette.neutral700,
                    fontWeight: key === surfaceKey ? 600 : 400,
                  }}
                >
                  {SURFACE_LABELS[key]}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Route preview card (shown on click) */}
      {showPreview && (
        <div
          className="absolute bottom-3 right-3 z-10 w-72 rounded-xl p-4 shadow-lg"
          style={{ backgroundColor: palette.white }}
        >
          <div className="flex items-start justify-between">
            <h3
              className="text-sm font-bold leading-tight"
              style={{ color: palette.neutral900 }}
            >
              {route.name ?? 'Unnamed Route'}
            </h3>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: palette.neutral100, color: palette.neutral500 }}
              aria-label="Close preview"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs" style={{ color: palette.neutral400 }}>Distance</p>
              <p className="text-sm font-semibold" style={{ color: palette.neutral800 }}>
                {formatDistance(route.distanceM)}
              </p>
            </div>
            {route.elevationGainM != null && (
              <div>
                <p className="text-xs" style={{ color: palette.neutral400 }}>Elevation</p>
                <p className="text-sm font-semibold" style={{ color: palette.neutral800 }}>
                  {formatElevation(route.elevationGainM)}
                </p>
              </div>
            )}
            {route.surfaceType && (
              <div>
                <p className="text-xs" style={{ color: palette.neutral400 }}>Surface</p>
                <p className="text-sm font-semibold capitalize" style={{ color: palette.neutral800 }}>
                  {route.surfaceType}
                </p>
              </div>
            )}
            {route.ratingAvg != null && (
              <div>
                <p className="text-xs" style={{ color: palette.neutral400 }}>Rating</p>
                <p className="text-sm font-semibold" style={{ color: palette.neutral800 }}>
                  {route.ratingAvg.toFixed(1)} ({route.ratingCount})
                </p>
              </div>
            )}
          </div>

          {/* CTA */}
          <a
            href={`#route-details`}
            className="mt-3 block w-full rounded-lg py-2 text-center text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: palette.primary500,
              color: palette.white,
            }}
          >
            View Full Route
          </a>
        </div>
      )}
    </div>
  );
}
