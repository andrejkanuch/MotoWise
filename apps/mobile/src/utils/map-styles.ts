export type MapStyle = 'dark' | 'light' | 'outdoors' | 'satellite' | 'hybrid' | 'terrain' | 'heatmap';

export const MAP_STYLES: Record<MapStyle, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  // Terrain uses outdoors as base + RasterDemSource/Terrain components for 3D elevation
  terrain: 'mapbox://styles/mapbox/outdoors-v12',
  // Heatmap uses dark as base + HeatmapLayer overlay
  heatmap: 'mapbox://styles/mapbox/dark-v11',
};

/** Styles that need special rendering (terrain 3D, heatmap overlay) */
export const TERRAIN_STYLES: MapStyle[] = ['terrain'];
export const HEATMAP_STYLES: MapStyle[] = ['heatmap'];

export function getDefaultMapStyle(isDark: boolean): MapStyle {
  return isDark ? 'dark' : 'light';
}

export function cycleMapStyle(current: MapStyle): MapStyle {
  const order: MapStyle[] = ['light', 'dark', 'outdoors', 'satellite'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}
