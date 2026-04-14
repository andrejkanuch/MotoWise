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

import type { JsonLdBreadcrumbItem, RegionForJsonLd, RouteForJsonLd } from '@motovault/types';
import { BASE_URL } from '@/lib/constants';
import { SCHEMA_IDS } from './schema';

export type { JsonLdBreadcrumbItem, RegionForJsonLd, RouteForJsonLd };

/** @deprecated Use `JsonLdBreadcrumbItem` from `@motovault/types` */
export type BreadcrumbItem = JsonLdBreadcrumbItem;

type JsonLdNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Route → TouristAttraction
// ---------------------------------------------------------------------------

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

export function breadcrumbSchema(items: JsonLdBreadcrumbItem[]): JsonLdNode {
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
