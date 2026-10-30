'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import { type ResolvedTheme, Theme, useTheme } from '@/providers/theme-provider';

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

const MAPBOX_GL_VERSION = 'v3.6.0';
const MAPBOX_GL_CSS = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css`;
const MAPBOX_GL_JS = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js`;

/** The map follows the page's scheme: graphite under dark, paper under light. */
const MAP_STYLE: Record<ResolvedTheme, string> = {
  [Theme.Dark]: 'mapbox://styles/mapbox/dark-v11',
  [Theme.Light]: 'mapbox://styles/mapbox/light-v11',
};

/** How long the CDN gets before the box says the map did not load. */
const MAP_LOAD_GIVE_UP_MS = 15_000;

const MapState = { Loading: 'loading', Ready: 'ready', Unavailable: 'unavailable' } as const;
type MapState = (typeof MapState)[keyof typeof MapState];

const MAP_STATE_TEXT: Record<Exclude<MapState, typeof MapState.Ready>, string> = {
  [MapState.Loading]: 'Loading map…',
  [MapState.Unavailable]: "The map didn't load. The route list still works.",
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

/**
 * True once the element has been on screen. The country/region pages keep
 * both the desktop and the mobile tree in the DOM; the hidden one must not
 * initialise a map (and bill tiles) on every phone visit.
 */
function useSeen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, seen]);
  return seen;
}

/** The selected route mark is the one copper object on the map. Targets the
 *  inner div — never `el.style.transform`, which Mapbox uses for positioning. */
function stylePin({ el }: MarkerEntry, isActive: boolean) {
  const inner = el.querySelector('.mv-pin-inner') as HTMLDivElement | null;
  if (!inner) return;
  inner.style.transform = isActive ? 'scale(1.4)' : 'scale(1)';
  inner.style.background = isActive ? 'var(--mv-copper)' : 'var(--mv-surface-2)';
  inner.style.borderColor = isActive ? 'var(--mv-copper)' : 'var(--mv-line-step)';
  inner.style.color = isActive ? 'var(--mv-on-copper)' : 'var(--mv-ink)';
  el.style.zIndex = isActive ? '10' : '1';
}

function MapboxMapInner({
  trips,
  hoveredId,
  focusedId,
  onPinClick,
  center,
  zoom,
  visibleIds,
  scriptFailed,
}: MapboxMapProps & { scriptFailed: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance>(null);
  const appliedStyleRef = useRef<string | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  // Markers arrive on 'load', after the first hover/focus effect has run.
  const activeRef = useRef<{ hoveredId: string | null; focusedId: string | null }>({
    hoveredId,
    focusedId,
  });
  activeRef.current = { hoveredId, focusedId };
  const { resolvedTheme } = useTheme();
  const seen = useSeen(containerRef);
  const [state, setState] = useState<MapState>(MapState.Loading);

  // biome-ignore lint/correctness/useExhaustiveDependencies: map init runs once per mount — trips are static per page load; the scheme is applied by setStyle below
  useEffect(() => {
    if (!containerRef.current || !seen) return;

    // biome-ignore lint/suspicious/noExplicitAny: globalThis access for CDN-loaded mapbox
    const mapboxgl = (globalThis as Record<string, any>).mapboxgl as MapboxGl;
    if (!mapboxgl) return;

    const token =
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
    if (!token) {
      setState(MapState.Unavailable);
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE[resolvedTheme],
      center: center ?? [-98, 39],
      zoom: zoom ?? 3.4,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      cooperativeGestures: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    appliedStyleRef.current = MAP_STYLE[resolvedTheme];

    map.on('load', () => {
      setState(MapState.Ready);
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
          width: 30px; height: 30px; border-radius: var(--mv-radius-pill);
          background: var(--mv-surface-2);
          border: 1px solid var(--mv-line-step);
          color: var(--mv-ink);
          display: grid; place-items: center;
          font-family: var(--mv-font-display); font-size: 13px; font-weight: 600;
          font-variant-numeric: tabular-nums;
          box-shadow: none;
          transition: transform 160ms var(--mv-ease-expo), background-color 160ms, color 160ms, border-color 160ms;
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
      const { hoveredId: h, focusedId: f } = activeRef.current;
      for (const entry of markersRef.current) stylePin(entry, entry.id === h || entry.id === f);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [center, zoom, seen]);

  // The scheme toggle restyles the live map; DOM markers survive setStyle.
  useEffect(() => {
    const map = mapRef.current;
    const next = MAP_STYLE[resolvedTheme];
    if (!map || appliedStyleRef.current === next) return;
    appliedStyleRef.current = next;
    map.setStyle(next);
  }, [resolvedTheme]);

  // The CDN never answered, or its script failed: say so instead of a blank box.
  useEffect(() => {
    if (scriptFailed) setState(MapState.Unavailable);
  }, [scriptFailed]);
  useEffect(() => {
    if (state !== MapState.Loading || !seen) return;
    const timer = setTimeout(() => {
      setState((s) => (s === MapState.Loading ? MapState.Unavailable : s));
    }, MAP_LOAD_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [state, seen]);

  // Toggle marker visibility based on filters (no map re-render)
  useEffect(() => {
    for (const { id, el } of markersRef.current) {
      const visible = !visibleIds || visibleIds.has(id);
      el.style.display = visible ? '' : 'none';
    }
  }, [visibleIds]);

  // Update hover/focus pin styles
  useEffect(() => {
    for (const entry of markersRef.current) {
      stylePin(entry, entry.id === hoveredId || entry.id === focusedId);
    }
  }, [hoveredId, focusedId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 600 }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 600,
          background: 'var(--mv-bg-2)',
        }}
      />
      {state !== MapState.Ready && (
        <p className="xp-map-state" role="status">
          {MAP_STATE_TEXT[state]}
        </p>
      )}
    </div>
  );
}

// Dynamic import wrapper — load Mapbox GL CSS + JS only on client
export function MapboxMap(props: MapboxMapProps) {
  const [ready, onReady] = useMapboxReady();
  const [scriptFailed, setScriptFailed] = useState(false);
  return (
    <>
      <link rel="stylesheet" href={MAPBOX_GL_CSS} />
      <Script
        src={MAPBOX_GL_JS}
        strategy="afterInteractive"
        onLoad={onReady}
        onError={() => setScriptFailed(true)}
      />
      <MapboxMapInner key={ready ? 'ready' : 'loading'} {...props} scriptFailed={scriptFailed} />
    </>
  );
}
