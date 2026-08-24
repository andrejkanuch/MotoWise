'use client';

import { useEffect, useRef, useState } from 'react';

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

const DAY_COLORS = [
  '#e0a040', // warm gold
  '#60b0e0', // sky blue
  '#70c070', // green
  '#e07070', // red
  '#c080e0', // purple
  '#e09060', // orange
  '#50c0c0', // teal
  '#e0b060', // amber
];

function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
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

/** Wait for the CDN-loaded mapboxgl global to become available. */
function useMapboxReady(): boolean {
  // Start false so the server and the client's first render agree on the
  // "Loading map…" placeholder. A warm CDN cache can define window.mapboxgl
  // before hydration; reading it in the useState initializer made the first
  // client render diverge from the server HTML and threw React #418.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
    if ((globalThis as Record<string, any>).mapboxgl) {
      setReady(true);
      return;
    }
    const id = setInterval(() => {
      // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
      if ((globalThis as Record<string, any>).mapboxgl) {
        setReady(true);
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);
  return ready;
}

function TripDetailMapInner({ waypoints, polyline }: TripDetailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: map init once
  useEffect(() => {
    if (!containerRef.current) return;

    // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
    const mapboxgl = (globalThis as Record<string, any>).mapboxgl as MapboxGl;
    if (!mapboxgl) return;

    const token =
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [waypoints[0]?.lng ?? 0, waypoints[0]?.lat ?? 0],
      zoom: 8,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Draw route polyline if available
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
          // Glow
          map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route-line',
            paint: {
              'line-color': '#e0a040',
              'line-width': 8,
              'line-blur': 6,
              'line-opacity': 0.35,
            },
          });
          // Main line
          map.addLayer({
            id: 'route-main',
            type: 'line',
            source: 'route-line',
            paint: {
              'line-color': '#e0a040',
              'line-width': 3,
              'line-opacity': 0.8,
            },
          });
        }
      }

      // Group waypoints by day
      const dayGroups = new Map<number, Waypoint[]>();
      for (const wp of waypoints) {
        const list = dayGroups.get(wp.dayIndex) ?? [];
        list.push(wp);
        dayGroups.set(wp.dayIndex, list);
      }
      const dayCount = dayGroups.size;

      // Draw day-connecting lines between waypoints (if no polyline)
      if (!polyline) {
        for (const [dayIndex, dayWps] of dayGroups) {
          const sorted = [...dayWps].sort((a, b) => a.sortOrder - b.sortOrder);
          if (sorted.length < 2) continue;

          const coords: [number, number][] = sorted.map((wp) => [wp.lng, wp.lat]);
          const color = getDayColor(dayIndex);

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
              'line-color': color,
              'line-width': 2.5,
              'line-opacity': 0.7,
              'line-dasharray': [3, 2],
            },
          });
        }
      }

      // Add numbered waypoint markers
      const sorted = [...waypoints].sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.sortOrder - b.sortOrder;
      });

      for (let i = 0; i < sorted.length; i++) {
        const wp = sorted[i];
        const color = getDayColor(wp.dayIndex);
        const isStart = wp.type === 'start';
        const isEnd = wp.type === 'end';
        const num = i + 1;

        // Wrapper — Mapbox controls transform on this, so don't touch it
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'cursor: pointer;';

        // Numbered pin (inner element — safe to transform)
        const el = document.createElement('div');
        const size = isStart || isEnd ? 34 : 28;
        el.style.cssText = `
          width: ${size}px; height: ${size}px; border-radius: 999px;
          background: oklch(0.13 0.01 55 / 0.95);
          border: 1.5px solid ${color};
          color: ${color};
          display: grid; place-items: center;
          font-family: 'Geist Mono', monospace; font-size: ${isStart || isEnd ? 13 : 11}px; font-weight: 600;
          box-shadow: 0 4px 12px -2px oklch(0 0 0 / 0.5);
          transition: transform .15s ease, background .15s ease, color .15s ease;
        `;
        el.textContent = String(num);
        wrapper.appendChild(el);

        // Hover: scale inner pin + fill
        wrapper.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.3)';
          el.style.background = color;
          el.style.color = '#1a1410';
          el.style.zIndex = '10';
        });
        wrapper.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.background = 'oklch(0.13 0.01 55 / 0.95)';
          el.style.color = color;
          el.style.zIndex = '';
        });

        // Click popup with stop details (high-contrast dark theme)
        const typeLabel = wp.type.replace(/_/g, ' ');
        const dayLine = dayCount > 1 ? `Day ${wp.dayIndex + 1}` : '';
        const popup = new mapboxgl.Popup({
          offset: 18,
          closeButton: true,
          closeOnClick: true,
          maxWidth: '240px',
          className: 'mv-wp-popup',
        }).setHTML(`
          <div style="
            font-family: 'Geist', sans-serif;
            background: oklch(0.13 0.01 55);
            color: oklch(0.92 0.02 55);
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid oklch(0.25 0.01 55);
            box-shadow: 0 8px 24px -4px oklch(0 0 0 / 0.6);
          ">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="
                width: 22px; height: 22px; border-radius: 999px;
                background: ${color}; color: #1a1410;
                display: grid; place-items: center;
                font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 700;
                flex-shrink: 0;
              ">${num}</span>
              <span style="font-size: 14px; font-weight: 600; line-height: 1.3;">${wp.name}</span>
            </div>
            <div style="
              display: flex; gap: 6px; flex-wrap: wrap;
              font-family: 'Geist Mono', monospace; font-size: 10px;
              letter-spacing: 0.06em; text-transform: uppercase;
              color: oklch(0.65 0.04 55);
            ">
              ${dayLine ? `<span style="background: oklch(0.2 0.01 55); padding: 2px 8px; border-radius: 4px;">${dayLine}</span>` : ''}
              <span style="background: oklch(0.2 0.01 55); padding: 2px 8px; border-radius: 4px;">${typeLabel}</span>
            </div>
            ${wp.notes ? `<div style="font-size: 12px; color: oklch(0.72 0.02 55); margin-top: 8px; line-height: 1.5;">${wp.notes}</div>` : ''}
          </div>
        `);

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
          const lastWrapper = map.getContainer().querySelectorAll('.mapboxgl-marker');
          if (lastWrapper.length >= 2) {
            const lastEl = lastWrapper[lastWrapper.length - 1] as HTMLElement;
            lastEl.style.marginLeft = '18px';
          }
        }
      }

      // Fit map to all waypoints
      if (waypoints.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const wp of waypoints) {
          bounds.extend([wp.lng, wp.lat]);
        }
        // Also include polyline bounds if available
        if (polyline) {
          const coords = decodePolyline(polyline);
          for (const c of coords) {
            bounds.extend(c);
          }
        }
        map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
      }
    });

    return () => map.remove();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 500,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    />
  );
}

export function TripDetailMap(props: TripDetailMapProps) {
  const ready = useMapboxReady();

  if (props.waypoints.length === 0) return null;

  return (
    <>
      <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css" />
      <script src="https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js" async />
      {ready ? (
        <TripDetailMapInner {...props} />
      ) : (
        <div
          style={{
            width: '100%',
            minHeight: 500,
            borderRadius: 16,
            background: 'oklch(0.10 0.009 55)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--mv-ink-3)',
            fontSize: 13,
          }}
        >
          Loading map...
        </div>
      )}
    </>
  );
}
