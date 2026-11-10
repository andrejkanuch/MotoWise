/** Mean Earth radius in metres, for great-circle distances. */
export const EARTH_RADIUS_M = 6_371_000;

/** Radians per degree. */
export const DEG = Math.PI / 180;

/** Great-circle distance between two points, in metres. */
export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * DEG;
  const dLng = (bLng - aLng) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
