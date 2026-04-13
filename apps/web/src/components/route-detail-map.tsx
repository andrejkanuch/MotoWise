'use client';

import { useCallback, useMemo, useState } from 'react';
import { MapHeroInteractive } from './map-hero-interactive';
import { ElevationChart, type ElevationDataPoint } from './elevation-chart';

export interface RouteDetailMapProps {
  /** GeoJSON LineString coordinates [[lng, lat], ...] */
  polyline: [number, number][];
  /** Elevation data points for the chart */
  elevationData: ElevationDataPoint[];
  /** Additional CSS class name */
  className?: string;
}

/**
 * Combines the interactive Mapbox map and elevation chart with
 * bidirectional hover synchronization.
 *
 * Desktop: side-by-side (map left, chart right)
 * Mobile: stacked (map top, chart bottom)
 */
export function RouteDetailMap({
  polyline,
  elevationData,
  className = '',
}: RouteDetailMapProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Derive the highlighted map point from the hovered chart index
  const highlightedPoint = useMemo(() => {
    if (hoveredIndex == null || hoveredIndex < 0 || hoveredIndex >= elevationData.length) {
      return null;
    }
    const point = elevationData[hoveredIndex];
    return { lng: point.lng, lat: point.lat };
  }, [hoveredIndex, elevationData]);

  const handleHoverIndex = useCallback((index: number | null) => {
    setHoveredIndex(index);
  }, []);

  return (
    <div className={`flex flex-col gap-4 lg:flex-row lg:gap-6 ${className}`}>
      {/* Map */}
      <div className="h-[320px] w-full overflow-hidden rounded-xl border border-neutral-200 lg:h-[420px] lg:flex-1">
        <MapHeroInteractive
          polyline={polyline}
          highlightedPoint={highlightedPoint}
          onHoverIndex={handleHoverIndex}
        />
      </div>

      {/* Elevation Chart */}
      <div className="h-[220px] w-full rounded-xl border border-neutral-200 bg-white p-4 lg:h-[420px] lg:w-[400px] lg:shrink-0">
        <ElevationChart
          elevationData={elevationData}
          onHoverIndex={handleHoverIndex}
          hoveredIndex={hoveredIndex}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
