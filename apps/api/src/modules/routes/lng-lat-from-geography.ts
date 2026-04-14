/**
 * Parse PostGIS geography / geometry point values returned by PostgREST (Supabase).
 * Common shapes: GeoJSON Point `{ type, coordinates: [lng, lat] }`, EWKT string.
 */
export function lngLatFromGeography(value: unknown): { lat: number; lng: number } | undefined {
  if (value == null) return undefined;

  if (typeof value === 'object' && value !== null && 'coordinates' in value) {
    const geo = value as { type?: string; coordinates?: unknown };
    const isPointish = geo.type === undefined || geo.type === 'Point';
    if (isPointish && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
      const lng = Number(geo.coordinates[0]);
      const lat = Number(geo.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }

  if (typeof value === 'string') {
    const pointMatch = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
      const lng = Number(pointMatch[1]);
      const lat = Number(pointMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }

  return undefined;
}
