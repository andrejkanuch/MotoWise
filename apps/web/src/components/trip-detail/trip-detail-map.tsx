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
  const [ready, setReady] = useState(
    // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
    () => !!(globalThis as Record<string, any>).mapboxgl,
  );
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => {
      // biome-ignore lint/suspicious/noExplicitAny: globalThis CDN access
      if ((globalThis as Record<string, any>).mapboxgl) {
        setReady(true);
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, [ready]);
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

      // Add waypoint markers
      const sorted = [...waypoints].sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.sortOrder - b.sortOrder;
      });

      for (const wp of sorted) {
        const color = getDayColor(wp.dayIndex);
        const isStart = wp.type === 'start';
        const isEnd = wp.type === 'end';

        const el = document.createElement('div');
        el.style.cssText = `
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          cursor: default;
        `;

        // Pin circle
        const pin = document.createElement('div');
        const size = isStart || isEnd ? 16 : 12;
        pin.style.cssText = `
          width: ${size}px; height: ${size}px; border-radius: 999px;
          background: ${isStart || isEnd ? color : 'oklch(0.14 0.01 55)'};
          border: 2px solid ${color};
          box-shadow: 0 0 8px ${color}44;
          transition: transform 0.15s ease;
        `;
        el.appendChild(pin);

        // Label below pin
        const label = document.createElement('div');
        const dayLabel = dayCount > 1 ? `D${wp.dayIndex + 1} · ` : '';
        label.style.cssText = `
          font-family: 'Geist Mono', monospace; font-size: 9px; font-weight: 600;
          color: oklch(0.85 0.04 55); letter-spacing: 0.05em;
          white-space: nowrap; text-align: center;
          background: oklch(0.1 0.008 55 / 0.85); padding: 2px 6px; border-radius: 4px;
          max-width: 120px; overflow: hidden; text-overflow: ellipsis;
        `;
        label.textContent = `${dayLabel}${wp.name}`;
        el.appendChild(label);

        // Popup on hover
        const popup = new mapboxgl.Popup({
          offset: 20,
          closeButton: false,
          closeOnClick: false,
          className: 'mv-waypoint-popup',
        }).setHTML(`
          <div style="font-family: 'Geist', sans-serif; padding: 8px 12px; max-width: 200px;">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">${wp.name}</div>
            <div style="font-size: 11px; color: #999; text-transform: capitalize;">
              ${dayCount > 1 ? `Day ${wp.dayIndex + 1} · ` : ''}${wp.type.replace(/_/g, ' ')}
            </div>
            ${wp.notes ? `<div style="font-size: 11px; color: #aaa; margin-top: 4px;">${wp.notes}</div>` : ''}
          </div>
        `);

        el.addEventListener('mouseenter', () => {
          pin.style.transform = 'scale(1.5)';
        });
        el.addEventListener('mouseleave', () => {
          pin.style.transform = 'scale(1)';
        });

        new mapboxgl.Marker({ element: el }).setLngLat([wp.lng, wp.lat]).setPopup(popup).addTo(map);
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
