/**
 * Extract ISO 3166-1 alpha-2 from Mapbox Geocoding "country" lookup (first feature).
 */
export function mapboxCountryShortCodeFromJson(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length < 1) return undefined;
  const f0 = features[0];
  if (typeof f0 !== 'object' || f0 === null) return undefined;
  const shortCode = (f0 as { properties?: { short_code?: unknown } }).properties?.short_code;
  if (shortCode && typeof shortCode === 'string') return shortCode.toLowerCase();
  return undefined;
}
