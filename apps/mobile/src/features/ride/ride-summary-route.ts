import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';

/** Speed bands for the route's gradient, in km/h. */
const SLOW_BELOW_KMH = 30;
const MEDIUM_BELOW_KMH = 80;
/** Most gradient stops the map line gets; more are downsampled. */
const MAX_COLOR_STOPS = 200;

/**
 * The ended ride's line on the summary map, from its recorded points in order:
 * GeoJSON, padded bounds, speed-gradient stops and the start and end points.
 * `null` with fewer than two points.
 */
export function buildSummaryRoute(
  combined: readonly Pick<Waypoint, 'latitude' | 'longitude' | 'speedMps'>[],
) {
  if (combined.length < 2) return null;

  const coordinates: [number, number][] = [];
  const speedValues: number[] = [];

  let minLng = combined[0].longitude;
  let maxLng = combined[0].longitude;
  let minLat = combined[0].latitude;
  let maxLat = combined[0].latitude;

  let cumulativeDistance = 0;
  const distances: number[] = [0];

  for (let i = 0; i < combined.length; i++) {
    const wp = combined[i];
    coordinates.push([wp.longitude, wp.latitude]);
    speedValues.push(wp.speedMps ?? 0);

    if (wp.longitude < minLng) minLng = wp.longitude;
    if (wp.longitude > maxLng) maxLng = wp.longitude;
    if (wp.latitude < minLat) minLat = wp.latitude;
    if (wp.latitude > maxLat) maxLat = wp.latitude;

    if (i > 0) {
      const prev = combined[i - 1];
      const segDist = Math.sqrt(
        (wp.longitude - prev.longitude) ** 2 + (wp.latitude - prev.latitude) ** 2,
      );
      cumulativeDistance += segDist;
      distances.push(cumulativeDistance);
    }
  }

  // Speed-gradient color stops — downsample to max ~200 entries
  const totalDist = cumulativeDistance || 1;
  const rawStops: [number, string][] = [];
  let lastPct = -1;
  for (let i = 0; i < combined.length; i++) {
    const pct = Math.round((distances[i] / totalDist) * 10000) / 10000;
    if (pct <= lastPct) continue;
    const speedKmh = (speedValues[i] ?? 0) * 3.6;
    let color: string;
    if (speedKmh < SLOW_BELOW_KMH) color = palette.speedSlow;
    else if (speedKmh < MEDIUM_BELOW_KMH) color = palette.speedMedium;
    else color = palette.speedFast;
    rawStops.push([pct, color]);
    lastPct = pct;
  }

  let colorStops = rawStops;
  if (rawStops.length > MAX_COLOR_STOPS) {
    const step = Math.ceil(rawStops.length / MAX_COLOR_STOPS);
    colorStops = rawStops.filter((_, i) => i === 0 || i === rawStops.length - 1 || i % step === 0);
  }

  if (colorStops.length === 0) {
    colorStops = [
      [0, palette.speedSlow],
      [1, palette.speedSlow],
    ];
  } else {
    if (colorStops[0][0] !== 0) colorStops.unshift([0, colorStops[0][1]]);
    if (colorStops[colorStops.length - 1][0] !== 1)
      colorStops.push([1, colorStops[colorStops.length - 1][1]]);
  }

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      },
    ],
  };

  const bounds = {
    ne: [maxLng + 0.005, maxLat + 0.005] as [number, number],
    sw: [minLng - 0.005, minLat - 0.005] as [number, number],
  };

  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];

  return { geojson, bounds, colorStops, startPoint, endPoint };
}
