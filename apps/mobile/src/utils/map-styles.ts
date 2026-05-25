export const MAP_STYLE_KEYS = {
  DARK: 'dark',
  LIGHT: 'light',
  OUTDOORS: 'outdoors',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
  HEATMAP: 'heatmap',
} as const;

export type MapStyle = (typeof MAP_STYLE_KEYS)[keyof typeof MAP_STYLE_KEYS];

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
} as const;

/** Styles that activate 3D terrain rendering (RasterDemSource + Terrain + Sky + Atmosphere) */
export const TERRAIN_3D_STYLES = [MAP_STYLE_KEYS.TERRAIN] as const;

/** Styles that activate heatmap overlay layer */
export const HEATMAP_OVERLAY_STYLES = [MAP_STYLE_KEYS.HEATMAP] as const;

/** Check if a map style needs 3D terrain components */
export function needsTerrain3D(style: MapStyle): boolean {
  return (TERRAIN_3D_STYLES as readonly string[]).includes(style);
}

/** Check if a map style needs heatmap overlay */
export function needsHeatmapOverlay(style: MapStyle): boolean {
  return (HEATMAP_OVERLAY_STYLES as readonly string[]).includes(style);
}

export function getDefaultMapStyle(isDark: boolean): MapStyle {
  return isDark ? MAP_STYLE_KEYS.DARK : MAP_STYLE_KEYS.LIGHT;
}

export function cycleMapStyle(current: MapStyle): MapStyle {
  const order: MapStyle[] = [
    MAP_STYLE_KEYS.LIGHT,
    MAP_STYLE_KEYS.DARK,
    MAP_STYLE_KEYS.OUTDOORS,
    MAP_STYLE_KEYS.SATELLITE,
  ];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}
