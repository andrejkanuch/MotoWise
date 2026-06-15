import type { BrowsePlaceFieldsFragment, TripTemplatesQuery } from '@motovault/graphql';
import {
  BrowseCountriesDocument,
  BrowseCountryBySlugDocument,
  BrowseExploreRegionDocument,
  BrowseRegionsByCountrySlugDocument,
  SitemapPublishedTripsDocument,
  TripTemplatesDocument,
} from '@motovault/graphql';
import type { BrowsePlace, RouteListItem } from '@motovault/types';
import { unstable_cache } from 'next/cache';
import { gqlServerFetcher } from '@/lib/graphql-server';
import type { TripSlugRef } from '@/lib/trips/bare-slug-redirect';

/** Alias for `BrowsePlace` — shared type lives in `@motovault/types`. */
export type Place = BrowsePlace;
export type { RouteListItem };

function gqlPlaceToPlace(p: BrowsePlaceFieldsFragment): BrowsePlace {
  const kind =
    p.kind === 'country' || p.kind === 'region' || p.kind === 'city' ? p.kind : 'country';
  return {
    id: p.id,
    kind,
    name: p.name,
    countryCode: p.countryCode,
    regionCode: p.regionCode ?? null,
    slug: p.slug,
    parentId: p.parentId ?? null,
    routeCount: p.routeCount,
  };
}

// ---- Queries (GraphQL API) ----

/** Fetch all countries that have at least 1 route. Cached for 1 hour. */
export const fetchCountries = unstable_cache(
  async (): Promise<Place[]> => {
    const data = await gqlServerFetcher(BrowseCountriesDocument);
    return data.browseCountries.map(gqlPlaceToPlace);
  },
  ['browse-countries'],
  { revalidate: 3600 },
);

/** Fetch a country by its slug (lowercase country code, e.g. "it"). */
export async function fetchCountryBySlug(slug: string): Promise<Place | null> {
  const data = await gqlServerFetcher(BrowseCountryBySlugDocument, { slug });
  const row = data.browseCountryBySlug;
  if (!row) return null;
  return gqlPlaceToPlace(row);
}

/** Fetch regions for a given country slug. */
export async function fetchRegionsByCountrySlug(countrySlug: string): Promise<Place[]> {
  const data = await gqlServerFetcher(BrowseRegionsByCountrySlugDocument, { countrySlug });
  return data.browseRegionsByCountrySlug.map(gqlPlaceToPlace);
}

/** Fetch a region by country slug + region slug. */
export async function fetchRegionBySlug(
  countrySlug: string,
  regionSlug: string,
): Promise<{ country: Place; region: Place } | null> {
  const data = await gqlServerFetcher(BrowseExploreRegionDocument, { countrySlug, regionSlug });
  const bundle = data.browseExploreRegion;
  if (!bundle) return null;
  return {
    country: gqlPlaceToPlace(bundle.country),
    region: gqlPlaceToPlace(bundle.region),
  };
}

function tripNodeToRouteListItem(node: TripTemplateNode): RouteListItem {
  return {
    id: node.id,
    name: node.title ?? null,
    displayName: node.title ?? null,
    distanceM: node.distanceM ?? 0,
    elevationGainM: node.elevationGainM ?? null,
    surfaceType: node.surfaceType ?? null,
    curvatureIndex: node.curvatureIndex ?? null,
    ratingAvg: node.averageRating ?? null,
    ratingCount: node.reviewCount ?? 0,
    slug: node.slug ?? null,
    countryCode: node.countryCode ?? null,
    regionSlug: node.regionCode ?? null,
  };
}

/** Route row for /explore/[country] cards (map thumbnail + description). */
export type ExploreRouteWithMap = RouteListItem & {
  description: string | null;
  polyline: string | null;
};

function tripNodeToExploreRouteWithMap(node: TripTemplateNode): ExploreRouteWithMap {
  return {
    ...tripNodeToRouteListItem(node),
    description: node.description ?? null,
    polyline: node.polyline ?? null,
  };
}

/** Top trips for a country — uses trip templates. */
export async function fetchExploreRoutesByCountry(
  countryCode: string,
  limit = 50,
): Promise<ExploreRouteWithMap[]> {
  const templates = await fetchTripTemplatesByCountry(countryCode, limit);
  return templates.map(tripNodeToExploreRouteWithMap);
}

/** Fetch published trips for a country+region. */
export async function fetchRoutesByRegion(
  countryCode: string,
  regionSlug: string,
  limit = 50,
): Promise<RouteListItem[]> {
  const templates = await fetchTripTemplatesByRegion(countryCode, regionSlug, limit);
  return templates.map(tripNodeToRouteListItem);
}

/** Fetch published trips for a country. */
export async function fetchRoutesByCountry(
  countryCode: string,
  limit = 50,
): Promise<RouteListItem[]> {
  const templates = await fetchTripTemplatesByCountry(countryCode, limit);
  return templates.map(tripNodeToRouteListItem);
}

// ---- Trip Templates ----

export type TripTemplateNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

/** Fetch trip templates for a given country. */
export async function fetchTripTemplatesByCountry(
  countryCode: string,
  limit = 50,
): Promise<TripTemplateNode[]> {
  const data = await gqlServerFetcher(TripTemplatesDocument, {
    filter: { country: countryCode.toLowerCase() },
    first: limit,
  });
  return data.tripTemplates.edges.map((e) => e.node);
}

/** Fetch trip templates for a given country+region (via country filter — region filtering handled client-side). */
export async function fetchTripTemplatesByRegion(
  countryCode: string,
  regionSlug: string,
  limit = 50,
): Promise<TripTemplateNode[]> {
  // TripTemplateFilterInput does not have a region field currently,
  // so we fetch by country and filter client-side.
  const all = await fetchTripTemplatesByCountry(countryCode, limit);
  return all.filter((t) => t.regionCode?.toLowerCase() === regionSlug.toLowerCase());
}

/**
 * All published trip slug refs (country/region/slug), uncapped. Backs the
 * bare-slug → canonical 301 fallback on trip detail 404s, where the paginated
 * `tripTemplates` query (capped at 50 server-side) could miss the target trip.
 */
export async function fetchPublishedTripSlugRefs(): Promise<TripSlugRef[]> {
  const data = await gqlServerFetcher(SitemapPublishedTripsDocument);
  return data.sitemapPublishedTrips.map((t) => ({
    countryCode: t.countryCode,
    regionCode: t.regionCode,
    slug: t.slug,
  }));
}
