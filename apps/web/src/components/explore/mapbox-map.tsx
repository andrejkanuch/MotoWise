'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';

interface MapboxMapProps {
  trips: TripTemplateNode[];
  hoveredId: string | null;
  focusedId: string | null;
  onPinClick?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  /** IDs of trips currently visible after filtering */
  visibleIds?: Set<string>;
}

// biome-ignore lint/suspicious/noExplicitAny: Mapbox GL loaded via CDN, no type-safe import
type MapboxGl = any;
// biome-ignore lint/suspicious/noExplicitAny: Mapbox GL loaded via CDN
type MapInstance = any;
// biome-ignore lint/suspicious/noExplicitAny: Mapbox GL loaded via CDN
type MarkerInstance = any;

type MarkerEntry = {
  id: string;
  el: HTMLDivElement;
  marker: MarkerInstance;
  lng: number;
  lat: number;
};

/**
 * Track Mapbox script readiness via the `onLoad` callback instead of polling.
 *
 * The latch is module-scoped, and the hook below also probes the global
 * directly, because `onLoad` is not guaranteed to fire: `next/script`'s
 * `loadScript` returns early when its cacheKey (`id || src` — this `<Script>`
 * passes no `id`, so the shared CDN `src`) is already in `LoadCache`. A second
 * `<MapboxMap>`, or a client-side navigation back to a map route, would
 * otherwise wait forever for an event that already happened.
 */
let _mapboxReady = false;
const _listeners = new Set<() => void>();

// biome-ignore lint/suspicious/noExplicitAny: globalThis access for CDN-loaded mapbox
const isMapboxGlobalPresent = () => !!(globalThis as Record<string, any>).mapboxgl;

function notifyMapboxReady() {
  _mapboxReady = true;
  for (const fn of _listeners) fn();
  _listeners.clear();
}

function useMapboxReady(): [boolean, () => void] {
  // MUST start `false`. The server has no `window.mapboxgl` and always renders
  // the not-ready tree, so seeding this from the module latch (which used to be
  // initialised from `globalThis.mapboxgl` at module-eval time) made the first
  // client render diverge from the server HTML whenever the CDN bundle was
  // already cached — the React #418 hydration mismatch fixed on the trip map in
  // b3490255, still live here. Detect the global post-mount instead.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (_mapboxReady || isMapboxGlobalPresent()) {
      setReady(true);
      return;
    }
    const handler = () => setReady(true);
    _listeners.add(handler);
    return () => {
      _listeners.delete(handler);
    };
  }, []);
  return [ready, notifyMapboxReady];
}

function MapboxMapInner({
  trips,
  hoveredId,
  focusedId,
  onPinClick,
  center,
  zoom,
  visibleIds,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  // biome-ignore lint/correctness/useExhaustiveDependencies: map init runs once per mount — trips are static per page load
  useEffect(() => {
    if (!containerRef.current) return;

    // biome-ignore lint/suspicious/noExplicitAny: globalThis access for CDN-loaded mapbox
    const mapboxgl = (globalThis as Record<string, any>).mapboxgl as MapboxGl;
    if (!mapboxgl) return;

    const token =
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: center ?? [-98, 39],
      zoom: zoom ?? 3.4,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      cooperativeGestures: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      // Add markers for ALL trips (visibility toggled via CSS)
      trips.forEach((t, i) => {
        const lat = t.startLat;
        const lng = t.startLng;
        if (lat == null || lng == null) return;

        const el = document.createElement('div');
        el.className = 'mv-pin';
        el.dataset.id = t.id;
        // Outer wrapper must not set `transform` — Mapbox GL uses it for positioning
        el.style.cssText = `cursor: pointer;`;

        const inner = document.createElement('div');
        inner.className = 'mv-pin-inner';
        inner.style.cssText = `
          width: 30px; height: 30px; border-radius: 999px;
          background: oklch(0.13 0.01 55 / 0.95);
          border: 1.5px solid oklch(0.84 0.15 68);
          color: oklch(0.92 0.16 68);
          display: grid; place-items: center;
          font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 600;
          box-shadow: 0 6px 14px -4px oklch(0 0 0 / 0.6);
          transition: all .2s ease;
        `;
        inner.textContent = String(i + 1);
        el.appendChild(inner);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onPinClickRef.current?.(t.id);
        });

        const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push({ id: t.id, marker, el, lng, lat });
      });
    });

    return () => {
      map.remove();
      markersRef.current = [];
    };
  }, [center, zoom]);

  // Toggle marker visibility based on filters (no map re-render)
  useEffect(() => {
    for (const { id, el } of markersRef.current) {
      const visible = !visibleIds || visibleIds.has(id);
      el.style.display = visible ? '' : 'none';
    }
  }, [visibleIds]);

  // Update hover/focus pin styles (target inner div — never touch el.style.transform)
  useEffect(() => {
    for (const { id, el } of markersRef.current) {
      const inner = el.querySelector('.mv-pin-inner') as HTMLDivElement | null;
      if (!inner) continue;
      const isActive = id === hoveredId || id === focusedId;
      inner.style.transform = isActive ? 'scale(1.4)' : 'scale(1)';
      inner.style.background = isActive ? 'oklch(0.84 0.15 68)' : 'oklch(0.13 0.01 55 / 0.95)';
      inner.style.color = isActive ? '#1a1410' : 'oklch(0.92 0.16 68)';
      el.style.zIndex = isActive ? '10' : '1';
    }
  }, [hoveredId, focusedId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 600,
        background: 'var(--mv-bg-2, oklch(0.10 0.009 55))',
      }}
    />
  );
}

// Dynamic import wrapper — load Mapbox GL CSS + JS only on client
export function MapboxMap(props: MapboxMapProps) {
  const [ready, onReady] = useMapboxReady();
  return (
    <>
      <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" />
      <Script
        src="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js"
        strategy="afterInteractive"
        onLoad={onReady}
      />
      <MapboxMapInner key={ready ? 'ready' : 'loading'} {...props} />
    </>
  );
}
