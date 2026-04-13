import { BASE_URL } from '@/lib/constants';

/** Canonical URL for a route detail page: /route/{country}/{region}/{slug} */
export const canonicalRoute = (country: string, region: string, slug: string) =>
  `${BASE_URL}/route/${country}/${region}/${slug}`;

/** Canonical URL for a region listing page: /explore/{country}/{region} */
export const canonicalRegion = (country: string, region: string) =>
  `${BASE_URL}/explore/${country}/${region}`;

/** Canonical URL for a country listing page: /explore/{country} */
export const canonicalCountry = (country: string) => `${BASE_URL}/explore/${country}`;

/** Canonical URL for the explore index page: /explore */
export const canonicalExplore = () => `${BASE_URL}/explore`;

/** Site root canonical URL. */
export const baseCanonical = () => BASE_URL;
