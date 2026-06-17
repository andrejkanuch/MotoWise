/** Haversine distance between two coordinates in meters */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** A coordinate in either `{lat,lng}` or `{latitude,longitude}` shape. */
export type Coordinate = { lat: number; lng: number } | { latitude: number; longitude: number };

const coordLat = (c: Coordinate): number => ('lat' in c ? c.lat : c.latitude);
const coordLng = (c: Coordinate): number => ('lng' in c ? c.lng : c.longitude);

/**
 * Haversine distance in meters between two coordinate objects, accepting either
 * the `{lat,lng}` or `{latitude,longitude}` shape. Thin wrapper over
 * `haversineDistance` so the great-circle math lives in exactly one place.
 */
export function haversineMeters(a: Coordinate, b: Coordinate): number {
  return haversineDistance(coordLat(a), coordLng(a), coordLat(b), coordLng(b));
}
