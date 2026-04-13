import { BASE_URL } from '@/lib/constants';

/** Canonical URL for a specific route page: /route/{country}/{region}/{slug} */
export function canonicalRoute(country: string, region: string, slug: string): string {
  return `${BASE_URL}/route/${country}/${region}/${slug}`;
}

/** Canonical URL for a region explore page: /explore/{country}/{region} */
export function canonicalRegion(country: string, region: string): string {
  return `${BASE_URL}/explore/${country}/${region}`;
}

/** Canonical URL for a country explore page: /explore/{country} */
export function canonicalCountry(country: string): string {
  return `${BASE_URL}/explore/${country}`;
}
