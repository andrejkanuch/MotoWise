export type MapStyle = 'dark' | 'light' | 'outdoors' | 'satellite';

export const MAP_STYLES: Record<MapStyle, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

const CYCLE_ORDER: MapStyle[] = ['light', 'dark', 'outdoors', 'satellite'];

export function getDefaultMapStyle(isDark: boolean): MapStyle {
  return isDark ? 'dark' : 'light';
}

export function cycleMapStyle(current: MapStyle): MapStyle {
  const idx = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
}
