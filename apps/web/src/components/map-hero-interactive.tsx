'use client';

import mapboxgl from 'mapbox-gl';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { palette } from '@motovault/design-system';

function readMapboxPublicToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
}

function StaticRoutePreview({ src, className }: { src: string; className: string }) {
  return (
    <div className={`relative h-full w-full ${className}`}>
      <Image
        src={src}
        alt="Route map preview"
        fill
        className="rounded-xl object-cover"
        sizes="(max-width: 1024px) 100vw, 1200px"
        unoptimized
      />
    </div>
  );
}

export interface MapHeroInteractiveProps {
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  polyline: [number, number][];
  /**
   * Server-built Mapbox Static Images URL (uses MAPBOX_ACCESS_TOKEN).
   * Shown when no public token is available in the browser bundle.
   */
  staticPreviewUrl?: string | null;
  /** Optional highlighted point [lng, lat] synced from elevation chart */
  highlightedPoint?: { lng: number; lat: number } | null;
  /** Called when user hovers the route on the map, with index into polyline */
  onHoverIndex?: (index: number | null) => void;
  /** Additional CSS class name */
  className?: string;
  /**
   * When the viewed route changes, pass its id so the map re-inits (polyline arrays may be new
   * references each render).
   */
  mapInstanceKey?: string;
}

function MapHeroMapInner({
  polyline,
  highlightedPoint,
  onHoverIndex,
  className = '',
  accessToken,
  mapInstanceKey,
  staticPreviewFallback,
}: Omit<MapHeroInteractiveProps, 'staticPreviewUrl'> & {
  accessToken: string;
  staticPreviewFallback?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onHoverIndexRef = useRef(onHoverIndex);
  onHoverIndexRef.current = onHoverIndex;
  const [loaded, setLoaded] = useState(false);
  const [webglBlocked, setWebglBlocked] = useState(false);

  const instanceKey = mapInstanceKey ?? `len:${polyline.length}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-init when route identity changes; `polyline` array identity is unstable across RSC passes.
  useEffect(() => {
    setWebglBlocked(false);

    if (!containerRef.current || polyline.length === 0) return;

    if (!mapboxgl.supported()) {
      setWebglBlocked(true);
      return;
    }

    mapboxgl.accessToken = accessToken;

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

    const line = polyline;

    map.on('load', () => {
      map.resize();

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: line,
          },
        },
      });

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

    map.on('mousemove', 'route-hit', (e) => {
      const cb = onHoverIndexRef.current;
      if (!cb || !e.lngLat) return;
      map.getCanvas().style.cursor = 'crosshair';

      let minDist = Number.POSITIVE_INFINITY;
      let nearestIdx = 0;
      const { lng, lat } = e.lngLat;
      for (let i = 0; i < line.length; i++) {
        const dx = line[i][0] - lng;
        const dy = line[i][1] - lat;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      cb(nearestIdx);
    });

    map.on('mouseleave', 'route-hit', () => {
      map.getCanvas().style.cursor = '';
      onHoverIndexRef.current?.(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // instanceKey (e.g. route id) must change when polyline geometry changes; avoid depending on
    // polyline array identity, which can be unstable across renders.
  }, [accessToken, instanceKey]);

  useEffect(() => {
    if (webglBlocked || !mapRef.current || !loaded) return;

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
  }, [highlightedPoint, loaded, webglBlocked]);

  if (webglBlocked) {
    if (staticPreviewFallback) {
      return <StaticRoutePreview src={staticPreviewFallback} className={className} />;
    }
    return (
      <div
        className={`flex h-full w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-center text-sm text-neutral-500 ${className}`}
      >
        <p>
          Interactive maps need WebGL. This browser or device does not support it — try another
          browser or update your graphics drivers.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full w-full overflow-hidden rounded-xl ${className}`} />
  );
}

export function MapHeroInteractive({
  polyline,
  staticPreviewUrl,
  highlightedPoint,
  onHoverIndex,
  className = '',
  mapInstanceKey,
}: MapHeroInteractiveProps) {
  const token = readMapboxPublicToken();

  if (polyline.length === 0) {
    return null;
  }

  if (!token) {
    if (staticPreviewUrl) {
      return <StaticRoutePreview src={staticPreviewUrl} className={className} />;
    }
    return (
      <div
        className={`flex h-full w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-center text-sm text-neutral-500 ${className}`}
      >
        <p>
          Set <code className="text-neutral-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> (or{' '}
          <code className="text-neutral-400">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>) in{' '}
          <code className="text-neutral-400">.env.local</code> for an interactive map, or{' '}
          <code className="text-neutral-400">MAPBOX_ACCESS_TOKEN</code> so the server can render a
          static preview.
        </p>
      </div>
    );
  }

  return (
    <MapHeroMapInner
      polyline={polyline}
      highlightedPoint={highlightedPoint}
      onHoverIndex={onHoverIndex}
      className={className}
      accessToken={token}
      mapInstanceKey={mapInstanceKey}
      staticPreviewFallback={staticPreviewUrl}
    />
  );
}
