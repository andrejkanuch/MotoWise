'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { palette } from '@motovault/design-system';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface MapHeroInteractiveProps {
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  polyline: [number, number][];
  /** Optional highlighted point [lng, lat] synced from elevation chart */
  highlightedPoint?: { lng: number; lat: number } | null;
  /** Called when user hovers the route on the map, with index into polyline */
  onHoverIndex?: (index: number | null) => void;
  /** Additional CSS class name */
  className?: string;
}

export function MapHeroInteractive({
  polyline,
  highlightedPoint,
  onHoverIndex,
  className = '',
}: MapHeroInteractiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || polyline.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const bounds = new mapboxgl.LngLatBounds();
    for (const coord of polyline) {
      bounds.extend(coord);
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      bounds,
      fitBoundsOptions: { padding: 60 },
      interactive: true,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // Route line source
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: polyline,
          },
        },
      });

      // Route outline (wider, darker)
      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': palette.primary900,
          'line-width': 6,
          'line-opacity': 0.4,
        },
      });

      // Route line (primary color)
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': palette.primary500,
          'line-width': 3.5,
          'line-opacity': 0.9,
        },
      });

      // Invisible wide line for hover detection
      map.addLayer({
        id: 'route-hit',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': 'transparent',
          'line-width': 20,
        },
      });

      setLoaded(true);
    });

    // Hover interaction on the route
    map.on('mousemove', 'route-hit', (e) => {
      if (!onHoverIndex || !e.lngLat) return;
      map.getCanvas().style.cursor = 'crosshair';

      // Find nearest polyline point
      let minDist = Number.POSITIVE_INFINITY;
      let nearestIdx = 0;
      const { lng, lat } = e.lngLat;
      for (let i = 0; i < polyline.length; i++) {
        const dx = polyline[i][0] - lng;
        const dy = polyline[i][1] - lat;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      onHoverIndex(nearestIdx);
    });

    map.on('mouseleave', 'route-hit', () => {
      map.getCanvas().style.cursor = '';
      onHoverIndex?.(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // polyline is static for a given route, no need to re-init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline.length]);

  // Sync highlighted point marker
  useEffect(() => {
    if (!mapRef.current || !loaded) return;

    if (highlightedPoint) {
      if (!markerRef.current) {
        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = palette.signature500;
        el.style.border = `2px solid ${palette.white}`;
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        el.style.pointerEvents = 'none';

        markerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([highlightedPoint.lng, highlightedPoint.lat])
          .addTo(mapRef.current);
      } else {
        markerRef.current.setLngLat([highlightedPoint.lng, highlightedPoint.lat]);
      }
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
    }
  }, [highlightedPoint, loaded]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full rounded-xl overflow-hidden ${className}`}
    />
  );
}
