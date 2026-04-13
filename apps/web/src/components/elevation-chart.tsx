'use client';

import { useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ChartEvent, ActiveElement } from 'chart.js';
import { palette } from '@motovault/design-system';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export interface ElevationDataPoint {
  /** Cumulative distance in km */
  distance: number;
  /** Elevation in meters */
  elevation: number;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
}

export interface ElevationChartProps {
  /** Array of elevation data points along the route */
  elevationData: ElevationDataPoint[];
  /** Callback when hovering a point — emits the index or null on leave */
  onHoverIndex?: (index: number | null) => void;
  /** Index of the currently highlighted point (from map hover) */
  hoveredIndex?: number | null;
  /** Additional CSS class name */
  className?: string;
}

export function ElevationChart({
  elevationData,
  onHoverIndex,
  hoveredIndex,
  className = '',
}: ElevationChartProps) {
  const chartRef = useRef<ChartJS<'line'> | null>(null);

  const labels = elevationData.map((d) =>
    d.distance < 10 ? d.distance.toFixed(1) : Math.round(d.distance).toString(),
  );
  const elevations = elevationData.map((d) => d.elevation);

  // Determine highlight point for external hover (from map)
  const pointBackgroundColors = elevationData.map((_, i) =>
    i === hoveredIndex ? palette.signature500 : 'transparent',
  );
  const pointRadii = elevationData.map((_, i) => (i === hoveredIndex ? 6 : 0));

  const data = {
    labels,
    datasets: [
      {
        label: 'Elevation (m)',
        data: elevations,
        fill: 'origin' as const,
        borderColor: palette.primary500,
        backgroundColor: `${palette.primary500}33`, // 20% opacity
        borderWidth: 2,
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBackgroundColors,
        pointRadius: pointRadii,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: palette.signature500,
        pointHoverBorderColor: palette.white,
        pointHoverBorderWidth: 2,
        tension: 0.3,
      },
    ],
  };

  const handleHover = useCallback(
    (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!onHoverIndex) return;
      if (elements.length > 0) {
        onHoverIndex(elements[0].index);
      } else {
        onHoverIndex(null);
      }
    },
    [onHoverIndex],
  );

  const handleLeave = useCallback(() => {
    onHoverIndex?.(null);
  }, [onHoverIndex]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    onHover: handleHover,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: palette.neutral900,
        titleColor: palette.neutral300,
        bodyColor: palette.white,
        borderColor: palette.neutral700,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return '';
            const point = elevationData[items[0].dataIndex];
            return `${point.distance.toFixed(1)} km`;
          },
          label: (item: { raw: unknown }) => {
            return `${Math.round(item.raw as number)} m`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Distance (km)',
          color: palette.neutral500,
          font: { size: 11 },
        },
        ticks: {
          color: palette.neutral400,
          font: { size: 10 },
          maxTicksLimit: 10,
          maxRotation: 0,
        },
        grid: {
          color: palette.neutral200,
          drawTicks: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Elevation (m)',
          color: palette.neutral500,
          font: { size: 11 },
        },
        ticks: {
          color: palette.neutral400,
          font: { size: 10 },
          maxTicksLimit: 6,
        },
        grid: {
          color: palette.neutral200,
          drawTicks: false,
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseLeave={handleLeave}
    >
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
