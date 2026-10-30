'use client';

import { palette } from '@motovault/design-system';
import { useEffect, useRef, useState } from 'react';
import { type ResolvedTheme, Theme, useTheme } from '@/providers/theme-provider';

interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  type: string;
  dayIndex: number;
  sortOrder: number;
  notes?: string | null;
}

interface TripDetailMapProps {
  waypoints: Waypoint[];
  polyline?: string | null;
}

// biome-ignore lint/suspicious/noExplicitAny: Mapbox GL loaded via CDN
type MapboxGl = any;

type MapScheme = ResolvedTheme;

/** The map follows the page's scheme: Mapbox's dark or light base, no custom style. */
const MAP_STYLE: Record<MapScheme, string> = {
  [Theme.Dark]: 'mapbox://styles/mapbox/dark-v11',
  [Theme.Light]: 'mapbox://styles/mapbox/light-v11',
};

// Line colours per scheme. Copper is the ridden-route mark (apps/mobile/DESIGN.md);
// the day legend uses the palette's categorical set — the hub hues on the dark
// base, the plateLightCat* set on the light base (the hub hues sit at 1.5–2.2:1
// on a light map). Mapbox paint wants bare colour strings, not CSS vars.
const ROUTE_COLOR: Record<MapScheme, string> = {
  [Theme.Dark]: palette.plateCopper,
  [Theme.Light]: palette.plateLightCopper,
};

const DAY_COLORS: Record<MapScheme, string[]> = {
  [Theme.Dark]: [
    palette.plateCopper,
    palette.hubCatService,
    palette.hubCatAccessories,
    palette.hubCatInsurance,
    palette.hubCatFuel,
    palette.hubCatTires,
    palette.hubCatParts,
    palette.hubCatMods,
  ],
  [Theme.Light]: [
    palette.plateLightCopper,
    palette.plateLightCatService,
    palette.plateLightCatAccessories,
    palette.plateLightCatInsurance,
    palette.plateLightCatFuel,
    palette.plateLightCatTires,
    palette.plateLightCatParts,
    palette.plateLightCatMods,
  ],
};

/** The CDN script gets this long to define `mapboxgl` before the map gives up. */
const MAPBOX_LOAD_TIMEOUT_MS = 10_000;
const MAPBOX_POLL_MS = 50;
/** A resize settles (rotation, address bar) before the route is fitted again. */
const REFIT_DEBOUNCE_MS = 150;
const MAPBOX_ORIGIN = 'https://api.mapbox.com';
const MAPBOX_GL_VERSION = 'v3.6.0';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

// Pins and popups are DOM, so they read the page's tokens (both schemes)
const PIN_STYLE = `
  border-radius: var(--mv-radius-pill);
  background: var(--mv-surface-2);
  border: 1px solid var(--mv-line-step);
  color: var(--mv-ink);
  display: grid; place-items: center;
  font-family: var(--mv-font-display); font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: transform var(--mv-dur-2) var(--mv-ease-expo), background-color var(--mv-dur-1), border-color var(--mv-dur-1), color var(--mv-dur-1);
`;

const POPUP_STYLE = `
  font-family: var(--mv-font-body);
  background: var(--mv-surface-2);
  color: var(--mv-ink);
  padding: 16px;
  border-radius: var(--mv-radius-control);
  border: 1px solid var(--mv-line);
  box-shadow: none;
`;

const POPUP_HEAD_STYLE = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';

const POPUP_NUM_STYLE = `
  width: 24px; height: 24px; border-radius: var(--mv-radius-pill);
  background: var(--mv-surface-3); color: var(--mv-ink);
  display: grid; place-items: center;
  font-family: var(--mv-font-display); font-size: 13px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
`;

const POPUP_NAME_STYLE = 'font-size: 15px; font-weight: 600; line-height: 1.45;';

const POPUP_CHIPS_STYLE = `
  display: flex; gap: 6px; flex-wrap: wrap;
  font-size: 13px; line-height: 18px; font-weight: 500;
  letter-spacing: 0;
  color: var(--mv-ink-2);
`;

const POPUP_CHIP_STYLE =
  'background: var(--mv-surface-3); padding: 2px 8px; border-radius: var(--mv-radius-small);';

const POPUP_NOTES_STYLE =
  'font-size: 13px; color: var(--mv-ink-3); margin-top: 8px; line-height: 18px;';

function sentenceCase(s: string): string {
  const words = s.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function getDayColor(scheme: MapScheme, dayIndex: number): string {
  const colors = DAY_COLORS[scheme];
  return colors[dayIndex % colors.length];
}

/** A styled element whose text is set through textContent — never markup. */
function el(tag: string, style: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.style.cssText = style;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The stop popup, built from DOM nodes. Waypoint names and notes are written
 * by the trip's organiser, so they are user data: setting them through
 * textContent is what keeps a `<img onerror>` in a note from running on every
 * reader of a public trip page. Never build this with setHTML.
 */
function buildPopupContent(wp: Waypoint, num: number, dayCount: number): HTMLElement {
  const root = el('div', POPUP_STYLE);

  const head = el('div', POPUP_HEAD_STYLE);
  head.appendChild(el('span', POPUP_NUM_STYLE, String(num)));
  head.appendChild(el('span', POPUP_NAME_STYLE, wp.name));
  root.appendChild(head);

  const chips = el('div', POPUP_CHIPS_STYLE);
  if (dayCount > 1) chips.appendChild(el('span', POPUP_CHIP_STYLE, `Day ${wp.dayIndex + 1}`));
  chips.appendChild(el('span', POPUP_CHIP_STYLE, sentenceCase(wp.type)));
  root.appendChild(chips);

  if (wp.notes) root.appendChild(el('div', POPUP_NOTES_STYLE, wp.notes));

  return root;
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

type MapboxLoadState = 'loading' | 'ready' | 'failed';

/**
 * Wait for the CDN-loaded mapboxgl global, and give up after a bounded wait so
 * a blocked CDN or a missing public token never leaves the placeholder up for
 * ever. Starts as 'loading' on both server and client so hydration agrees.
 */
function useMapboxLoadState(): MapboxLoadState {
  const [state, setState] = useState<MapboxLoadState>('loading');
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setState('failed');
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
    const hasMapbox = () => Boolean((globalThis as Record<string, any>).mapboxgl);
    if (hasMapbox()) {
      setState('ready');
      return;
    }
    const poll = setInterval(() => {
      if (hasMapbox()) {
        setState('ready');
        clearInterval(poll);
        clearTimeout(giveUp);
      }
    }, MAPBOX_POLL_MS);
    const giveUp = setTimeout(() => {
      clearInterval(poll);
      setState('failed');
    }, MAPBOX_LOAD_TIMEOUT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, []);
  return state;
}

/** Route and day lines are style layers, so they are redrawn after every setStyle. */
function drawLines(
  map: MapboxGl,
  waypoints: Waypoint[],
  polyline: string | null | undefined,
  scheme: MapScheme,
) {
  if (polyline) {
    const coords = decodePolyline(polyline);
    if (coords.length > 1) {
      map.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });
      // The route is the one highlighted object: copper, no glow
      map.addLayer({
        id: 'route-main',
        type: 'line',
        source: 'route-line',
        paint: {
          'line-color': ROUTE_COLOR[scheme],
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
    }
    return;
  }

  // No polyline: dashed day-to-day lines between the waypoints of each day
  const dayGroups = new Map<number, Waypoint[]>();
  for (const wp of waypoints) {
    const list = dayGroups.get(wp.dayIndex) ?? [];
    list.push(wp);
    dayGroups.set(wp.dayIndex, list);
  }
  for (const [dayIndex, dayWps] of dayGroups) {
    const sorted = [...dayWps].sort((a, b) => a.sortOrder - b.sortOrder);
    if (sorted.length < 2) continue;

    const coords: [number, number][] = sorted.map((wp) => [wp.lng, wp.lat]);
    map.addSource(`day-line-${dayIndex}`, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    });
    map.addLayer({
      id: `day-line-${dayIndex}`,
      type: 'line',
      source: `day-line-${dayIndex}`,
      paint: {
        'line-color': getDayColor(scheme, dayIndex),
        'line-width': 2.5,
        'line-opacity': 0.7,
        'line-dasharray': [3, 2],
      },
    });
  }
}

/** Numbered pins with their popups: DOM markers, so they survive a style swap. */
function addMarkers(map: MapboxGl, mapboxgl: MapboxGl, waypoints: Waypoint[]) {
  const dayCount = new Set(waypoints.map((wp) => wp.dayIndex)).size;
  const sorted = [...waypoints].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.sortOrder - b.sortOrder;
  });

  for (let i = 0; i < sorted.length; i++) {
    const wp = sorted[i];
    const isStart = wp.type === 'start';
    const isEnd = wp.type === 'end';
    const num = i + 1;

    // Wrapper — Mapbox controls transform on this, so don't touch it
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor: pointer;';

    // Numbered pin (inner element — safe to transform)
    const pin = document.createElement('div');
    const size = isStart || isEnd ? 34 : 28;
    pin.style.cssText = `${PIN_STYLE} width: ${size}px; height: ${size}px; font-size: ${isStart || isEnd ? 15 : 13}px;`;
    pin.textContent = String(num);
    wrapper.appendChild(pin);

    // Hover: scale the pin and fill it copper (selection is copper)
    wrapper.addEventListener('mouseenter', () => {
      pin.style.transform = 'scale(1.3)';
      pin.style.background = 'var(--mv-copper)';
      pin.style.borderColor = 'var(--mv-copper)';
      pin.style.color = 'var(--mv-on-copper)';
      pin.style.zIndex = '10';
    });
    wrapper.addEventListener('mouseleave', () => {
      pin.style.transform = 'scale(1)';
      pin.style.background = 'var(--mv-surface-2)';
      pin.style.borderColor = 'var(--mv-line-step)';
      pin.style.color = 'var(--mv-ink)';
      pin.style.zIndex = '';
    });

    // Click popup with stop details: the ramp, the body face, sentence case
    const popup = new mapboxgl.Popup({
      offset: 18,
      closeButton: true,
      closeOnClick: true,
      maxWidth: '240px',
      className: 'mv-wp-popup',
    }).setDOMContent(buildPopupContent(wp, num, dayCount));

    new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
      .setLngLat([wp.lng, wp.lat])
      .setPopup(popup)
      .addTo(map);
  }

  // If start and end overlap (same coords), offset the end marker slightly
  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (Math.abs(first.lat - last.lat) < 0.001 && Math.abs(first.lng - last.lng) < 0.001) {
      // Nudge last marker element to the right so both are visible
      const markers = map.getContainer().querySelectorAll('.mapboxgl-marker');
      if (markers.length >= 2) {
        const lastEl = markers[markers.length - 1] as HTMLElement;
        lastEl.style.marginLeft = '18px';
      }
    }
  }
}

function fitToRoute(
  map: MapboxGl,
  mapboxgl: MapboxGl,
  waypoints: Waypoint[],
  polyline?: string | null,
) {
  if (waypoints.length === 0) return;
  const bounds = new mapboxgl.LngLatBounds();
  for (const wp of waypoints) {
    bounds.extend([wp.lng, wp.lat]);
  }
  if (polyline) {
    for (const c of decodePolyline(polyline)) {
      bounds.extend(c);
    }
  }
  map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
}

function TripDetailMapInner({
  waypoints,
  polyline,
  scheme,
}: TripDetailMapProps & { scheme: MapScheme }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxGl>(null);
  const schemeRef = useRef(scheme);

  // biome-ignore lint/correctness/useExhaustiveDependencies: map init once; the scheme effect below handles changes
  useEffect(() => {
    if (!containerRef.current) return;

    // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
    const mapboxgl = (globalThis as Record<string, any>).mapboxgl as MapboxGl;
    if (!mapboxgl || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE[schemeRef.current],
      center: [waypoints[0]?.lng ?? 0, waypoints[0]?.lat ?? 0],
      zoom: 8,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    // The frame's height comes from its aspect ratio on phones, so a rotation
    // or a viewport change resizes the canvas: resize the map and fit the
    // route again, otherwise the markers can sit outside the new frame.
    let loaded = false;
    let refitTimer: ReturnType<typeof setTimeout> | undefined;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (!loaded) return;
            map.resize();
            clearTimeout(refitTimer);
            refitTimer = setTimeout(
              () => fitToRoute(map, mapboxgl, waypoints, polyline),
              REFIT_DEBOUNCE_MS,
            );
          });

    map.on('load', () => {
      drawLines(map, waypoints, polyline, schemeRef.current);
      addMarkers(map, mapboxgl, waypoints);
      fitToRoute(map, mapboxgl, waypoints, polyline);
      loaded = true;
      if (containerRef.current) observer?.observe(containerRef.current);
    });

    return () => {
      clearTimeout(refitTimer);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // The scheme toggle swaps the base style; lines are style layers, so they
  // are drawn again once the new style has loaded. Markers are DOM and stay.
  useEffect(() => {
    if (schemeRef.current === scheme) return;
    schemeRef.current = scheme;
    const map = mapRef.current;
    if (!map) return;
    map.once('style.load', () => drawLines(map, waypoints, polyline, scheme));
    map.setStyle(MAP_STYLE[scheme]);
  }, [scheme, waypoints, polyline]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 'var(--mv-radius-card)',
        overflow: 'hidden',
      }}
    />
  );
}

const PLACEHOLDER_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 'var(--mv-radius-card)',
  background: 'var(--mv-bg-2)',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  textAlign: 'center',
  color: 'var(--mv-ink-3)',
  fontSize: 15,
  lineHeight: 1.45,
  fontWeight: 500,
};

export function TripDetailMap(props: TripDetailMapProps) {
  const loadState = useMapboxLoadState();
  const { resolvedTheme: scheme } = useTheme();

  if (props.waypoints.length === 0) return null;

  return (
    <>
      {/* preconnect + a hoisted stylesheet: the map paints sooner on a cold load */}
      <link rel="preconnect" href={MAPBOX_ORIGIN} crossOrigin="" />
      <link
        rel="stylesheet"
        href={`${MAPBOX_ORIGIN}/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css`}
        precedence="default"
      />
      <script src={`${MAPBOX_ORIGIN}/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js`} async />
      {loadState === 'ready' && <TripDetailMapInner {...props} scheme={scheme} />}
      {loadState === 'loading' && (
        <div style={PLACEHOLDER_STYLE} aria-busy="true">
          Loading map…
        </div>
      )}
      {loadState === 'failed' && (
        <p style={PLACEHOLDER_STYLE} role="status">
          The map didn&apos;t load. Reload the page to try again, or download the GPX above to see
          the route.
        </p>
      )}
    </>
  );
}
