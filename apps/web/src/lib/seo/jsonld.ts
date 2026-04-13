/**
 * JSON-LD schema helpers for Route Discovery pages.
 *
 * These complement the existing `schema.ts` builders (SoftwareApplication,
 * Organization, WebSite, etc.) with route-specific structured data.
 *
 * Design notes:
 * - `TouristAttraction` is the recommended type for scenic motorcycle routes
 *   (Google treats it as an eligible entity for Maps/Travel rich results).
 * - `aggregateRating` is only emitted when >=3 ratings exist, to avoid
 *   thin-data warnings and ensure the number is statistically meaningful.
 * - `geo` uses WGS84 coordinates extracted from the route's start_point.
 * - `BreadcrumbList` here is route-specific; for marketing pages use
 *   `buildBreadcrumbList` from `./schema.ts`.
 */

import { BASE_URL } from '@/lib/constants';
import { SCHEMA_IDS } from './schema';

type JsonLdNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Route → TouristAttraction
// ---------------------------------------------------------------------------

export interface RouteForJsonLd {
  name: string;
  description: string | null;
  editorialDescription: string | null;
  distanceM: number;
  elevationGainM: number | null;
  surfaceType: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  /** Latitude of the route start point. */
  startLat: number;
  /** Longitude of the route start point. */
  startLng: number;
  /** ISO 3166-1 alpha-2 country code, lowercased for URL segments. */
  countryCode: string;
  /** Slugified region name. */
  regionSlug: string;
  /** URL-safe route slug. */
  slug: string;
  /** Human-readable country name for address. */
  countryName: string;
  /** Human-readable region name for address. */
  regionName: string;
}

export function routeToTouristAttraction(route: RouteForJsonLd): JsonLdNode {
  const url = `${BASE_URL}/route/${route.countryCode}/${route.regionSlug}/${route.slug}`;
  const description = route.editorialDescription ?? route.description ?? '';
  const distanceKm = Math.round(route.distanceM / 1000);

  const node: JsonLdNode = {
    '@type': 'TouristAttraction',
    '@id': `${url}#attraction`,
    name: route.name,
    description,
    url,
    touristType: 'Motorcycle touring',
    geo: {
      '@type': 'GeoCoordinates',
      latitude: route.startLat,
      longitude: route.startLng,
    },
    address: {
      '@type': 'PostalAddress',
      addressRegion: route.regionName,
      addressCountry: route.countryName,
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Distance',
        value: `${distanceKm} km`,
      },
      ...(route.elevationGainM != null
        ? [
            {
              '@type': 'PropertyValue',
              name: 'Elevation Gain',
              value: `${Math.round(route.elevationGainM)} m`,
            },
          ]
        : []),
      ...(route.surfaceType && route.surfaceType !== 'unknown'
        ? [
            {
              '@type': 'PropertyValue',
              name: 'Surface',
              value: route.surfaceType,
            },
          ]
        : []),
    ],
    isPartOf: { '@id': SCHEMA_IDS.website },
  };

  // Only emit aggregateRating when >= 3 ratings for statistical credibility
  if (route.ratingAvg != null && route.ratingCount >= 3) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: route.ratingAvg.toFixed(1),
      reviewCount: String(route.ratingCount),
      bestRating: '5',
      worstRating: '1',
    };
  }

  return node;
}

// ---------------------------------------------------------------------------
// Region → Place
// ---------------------------------------------------------------------------

export interface RegionForJsonLd {
  name: string;
  countryCode: string;
  regionSlug: string;
  countryName: string;
  description?: string;
}

export function regionToPlace(region: RegionForJsonLd): JsonLdNode {
  const url = `${BASE_URL}/explore/${region.countryCode}/${region.regionSlug}`;
  return {
    '@type': 'Place',
    '@id': `${url}#place`,
    name: region.name,
    url,
    ...(region.description ? { description: region.description } : {}),
    address: {
      '@type': 'PostalAddress',
      addressRegion: region.name,
      addressCountry: region.countryName,
    },
    isPartOf: { '@id': SCHEMA_IDS.website },
  };
}

// ---------------------------------------------------------------------------
// WebSite schema (route-discovery variant — no SearchAction per Nov 2024 deprecation)
// ---------------------------------------------------------------------------

export function websiteSchema(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': SCHEMA_IDS.website,
    name: 'MotoVault',
    url: BASE_URL,
    publisher: { '@id': SCHEMA_IDS.organization },
  };
}

// ---------------------------------------------------------------------------
// BreadcrumbList
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdNode {
  const lastUrl = items[items.length - 1]?.url ?? BASE_URL;
  return {
    '@type': 'BreadcrumbList',
    '@id': `${lastUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
