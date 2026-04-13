import { BASE_URL } from '@/lib/constants';

type JsonLdNode = Record<string, unknown>;

export interface RouteInput {
  name: string;
  description: string;
  url: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  regionName: string;
  ratingAvg?: number;
  ratingCount?: number;
  image?: string;
}

/**
 * Build a TouristAttraction JSON-LD node for a motorcycle route.
 * AggregateRating is only included when ratingCount >= 3 (statistical relevance).
 */
export function routeToTouristAttraction(route: RouteInput): JsonLdNode {
  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: route.name,
    description: route.description,
    url: route.url,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: route.latitude,
      longitude: route.longitude,
    },
    isAccessibleForFree: true,
    touristType: 'Motorcycle Touring',
  };

  if (route.image) {
    node.image = route.image;
  }

  if (
    route.ratingCount != null &&
    route.ratingCount >= 3 &&
    route.ratingAvg != null
  ) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: route.ratingAvg,
      reviewCount: route.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return node;
}

export interface RegionInput {
  name: string;
  description: string;
  url: string;
  countryCode: string;
}

/** Build a Place JSON-LD node for a region/state explore page. */
export function regionToPlace(region: RegionInput): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: region.name,
    description: region.description,
    url: region.url,
    address: {
      '@type': 'PostalAddress',
      addressCountry: region.countryCode,
    },
  };
}

/** Build a WebSite JSON-LD node for the site root. */
export function websiteSchema(args: { name: string; url?: string }): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: args.name,
    url: args.url ?? BASE_URL,
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** Build a BreadcrumbList JSON-LD node from an ordered trail. */
export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
